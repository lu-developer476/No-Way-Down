#!/usr/bin/env bash
set -euo pipefail

source_repo="$(git rev-parse --show-toplevel)"
GITHUB_SOURCE_SHA="${GITHUB_SOURCE_SHA:-$(git rev-parse HEAD)}"
GITHUB_SOURCE_REF="${GITHUB_SOURCE_REF:-refs/heads/main}"
: "${GITLAB_MIRROR_URL:?GITLAB_MIRROR_URL is required}"
: "${GITLAB_MIRROR_USERNAME:?GITLAB_MIRROR_USERNAME is required}"
: "${GITLAB_MIRROR_TOKEN:?GITLAB_MIRROR_TOKEN is required}"

fail() { printf 'Error: %s\n' "$1" >&2; exit 1; }
[[ "$GITHUB_SOURCE_REF" == "refs/heads/main" ]] || fail "GITHUB_SOURCE_REF must be refs/heads/main"
[[ "$GITHUB_SOURCE_SHA" =~ ^[0-9a-fA-F]{40}$ ]] || fail "GITHUB_SOURCE_SHA must be a full 40-character hexadecimal commit SHA"
source_commit_sha="$(git rev-parse "${GITHUB_SOURCE_SHA}^{commit}" 2>/dev/null)" || fail "GITHUB_SOURCE_SHA is not an available commit"
[[ "$source_commit_sha" == "${GITHUB_SOURCE_SHA,,}" ]] || fail "GITHUB_SOURCE_SHA does not resolve to the event commit"
source_tree_sha="$(git rev-parse "${GITHUB_SOURCE_SHA}^{tree}")"

if [[ "${GITHUB_EVENT_NAME:-}" == "push" ]]; then
  main_ref=''
  for candidate in refs/heads/main refs/remotes/origin/main; do
    if git show-ref --verify --quiet "$candidate"; then main_ref="$candidate"; break; fi
  done
  [[ -n "$main_ref" ]] || fail "main is unavailable; checkout must fetch main history"
  git merge-base --is-ancestor "$source_commit_sha" "$main_ref" || fail "source commit is not reachable from main"
  [[ "$(git rev-parse "$main_ref")" == "$source_commit_sha" ]] || fail "source SHA does not correspond to the pushed main event"
fi

mapfile -d '' source_paths < <(git ls-tree -r -z --name-only "$source_commit_sha")
lfs_paths=()
for path in "${source_paths[@]}"; do
  first_line="$(git show "${source_commit_sha}:${path}" 2>/dev/null | sed -n '1p' || true)"
  [[ "$first_line" == 'version https://git-lfs.github.com/spec/v1' ]] && lfs_paths+=("$path")
done
if ((${#lfs_paths[@]})); then
  printf 'Error: current source tree contains Git LFS pointers:\n' >&2
  printf ' - %s\n' "${lfs_paths[@]}" >&2
  exit 1
fi
if git cat-file -e "${source_commit_sha}:.gitattributes" 2>/dev/null && git show "${source_commit_sha}:.gitattributes" | grep -Eq 'filter[[:space:]]*=[[:space:]]*lfs|filter=lfs'; then
  fail "current .gitattributes activates filter=lfs"
fi
tracked_production_pngs="$(printf '%s\n' "${source_paths[@]}" | grep -E '^game/public/assets/production-art/.*\.png$' || true)"
[[ -z "$tracked_production_pngs" ]] || fail "current tree tracks generated production-art PNG files: ${tracked_production_pngs//$'\n'/, }"
git check-ignore -q game/public/assets/production-art/example.png || fail "generated production-art must remain ignored"

case "$GITLAB_MIRROR_URL" in
  https://*) ;;
  file://*|/*|./*|../*) ;;
  *) fail "GITLAB_MIRROR_URL must be an HTTPS Git URL or a local test repository" ;;
esac

temporary_directory="$(mktemp -d)"
trap 'rm -rf "$temporary_directory"' EXIT
mirror_repo="$temporary_directory/mirror"
git init -q "$mirror_repo"
git -C "$mirror_repo" config user.name 'No Way Down Mirror'
git -C "$mirror_repo" config user.email 'mirror@no-way-down.invalid'
git -C "$mirror_repo" remote add gitlab "$GITLAB_MIRROR_URL"
auth_header="AUTHORIZATION: Basic $(printf '%s:%s' "$GITLAB_MIRROR_USERNAME" "$GITLAB_MIRROR_TOKEN" | base64 | tr -d '\n')"
git_auth=(-c "http.extraheader=$auth_header")
remote_git() { git "${git_auth[@]}" -C "$mirror_repo" "$@"; }

build_snapshot() {
  if remote_git ls-remote --exit-code --heads gitlab refs/heads/main >/dev/null 2>&1; then
    remote_git fetch -q gitlab refs/heads/main
    git -C "$mirror_repo" checkout -q -B main FETCH_HEAD
  else
    git -C "$mirror_repo" checkout -q --orphan main
  fi
  git -C "$mirror_repo" rm -rf --ignore-unmatch . >/dev/null
  find "$mirror_repo" -mindepth 1 -maxdepth 1 ! -name .git -exec rm -rf {} +
  git -C "$source_repo" archive "$source_commit_sha" | tar -x -C "$mirror_repo"
  git -C "$mirror_repo" add -A
  git -C "$mirror_repo" commit -q --allow-empty -m "mirror: GitHub main ${source_commit_sha:0:7}" \
    -m "Source-GitHub-SHA: $source_commit_sha
Source-GitHub-Ref: refs/heads/main
Source-GitHub-Tree: $source_tree_sha
Mirror-Strategy: sanitized-current-tree-snapshot"
  mirror_tree_sha="$(git -C "$mirror_repo" rev-parse 'HEAD^{tree}')"
  if [[ "$mirror_tree_sha" != "$source_tree_sha" ]]; then
    printf 'Error: snapshot tree differs from source tree.\n' >&2
    git -C "$source_repo" diff --no-index -- "$source_repo" "$mirror_repo" >&2 || true
    return 1
  fi
}

build_snapshot
push_attempt=1
if ! remote_git push gitlab HEAD:refs/heads/main; then
  echo 'Mirror push raced with another publisher; rebuilding once on the new GitLab main.' >&2
  push_attempt=2
  build_snapshot
  remote_git push gitlab HEAD:refs/heads/main || fail "snapshot push failed after the single permitted retry"
fi

remote_snapshot_sha="$(remote_git ls-remote --heads gitlab refs/heads/main | awk '{print $1}')"
[[ "$remote_snapshot_sha" =~ ^[0-9a-f]{40}$ ]] || fail "GitLab main did not resolve after push"
remote_git fetch -q gitlab "$remote_snapshot_sha"
remote_tree_sha="$(git -C "$mirror_repo" rev-parse 'FETCH_HEAD^{tree}')"
[[ "$remote_tree_sha" == "$source_tree_sha" ]] || fail "post-push GitLab tree differs from GitHub source tree"
remote_message="$(git -C "$mirror_repo" log -1 --format=%B FETCH_HEAD)"
remote_source_sha="$(printf '%s\n' "$remote_message" | git interpret-trailers --parse | sed -n 's/^Source-GitHub-SHA:[[:space:]]*//p' | tail -n 1)"
[[ "$remote_source_sha" == "$source_commit_sha" ]] || fail "post-push Source-GitHub-SHA trailer is invalid"
[[ "$(git -C "$mirror_repo" rev-list --parents -n 1 FETCH_HEAD | wc -w)" -le 2 ]] || fail "snapshot unexpectedly has multiple parents"
for path in "${source_paths[@]}"; do
  first_line="$(git -C "$mirror_repo" show "FETCH_HEAD:${path}" 2>/dev/null | sed -n '1p' || true)"
  [[ "$first_line" != 'version https://git-lfs.github.com/spec/v1' ]] || fail "post-push snapshot contains an LFS pointer at $path"
done

summary="GitHub source SHA: $source_commit_sha
GitHub source tree: $source_tree_sha
GitLab snapshot commit: $remote_snapshot_sha
GitLab snapshot tree: $remote_tree_sha
Branch: main
Push attempts: $push_attempt
Result: verified"
printf '%s\n' "$summary"
if [[ -n "${NWD_MIRROR_EVIDENCE_FILE:-}" ]]; then printf '%s\n' "$summary" > "$NWD_MIRROR_EVIDENCE_FILE"; fi
