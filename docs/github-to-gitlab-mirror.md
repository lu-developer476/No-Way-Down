# Mirror automático de GitHub a GitLab

Este repositorio incluye un workflow de GitHub Actions que replica `main` hacia GitLab cada vez que `main` recibe un `push`. En la práctica, cuando se mergea un Pull Request en GitHub, GitHub Actions empuja el mismo commit al repositorio de GitLab y Render puede desplegar desde ese mirror.

## Workflow

El workflow está en `.github/workflows/mirror-to-gitlab.yml` y se ejecuta en estos casos:

- `push` a `main`, incluyendo merges de Pull Requests.
- Ejecución manual desde la pestaña **Actions** con `workflow_dispatch`.

La acción hace checkout con historial completo, agrega el remoto de GitLab por HTTPS y luego ejecuta:

```bash
git push gitlab HEAD:main --force-with-lease
```

`--force-with-lease` mantiene el mirror alineado con GitHub sin sobrescribir cambios remotos inesperados si GitLab avanzó por fuera del flujo automático.

## Secretos requeridos en GitHub

Configurar en **GitHub → Settings → Secrets and variables → Actions → Repository secrets**:

| Secreto | Requerido | Descripción |
| --- | --- | --- |
| `GITLAB_MIRROR_URL` | Sí | URL HTTPS del repositorio GitLab sin credenciales. Ejemplo: `https://gitlab.com/grupo/no-way-down.git`. |
| `GITLAB_MIRROR_TOKEN` | Sí | Personal Access Token o Project Access Token de GitLab con permiso de escritura sobre el repositorio. |
| `GITLAB_MIRROR_USERNAME` | No | Usuario para autenticar contra GitLab. Si se omite, se usa `oauth2`, que funciona con tokens HTTPS de GitLab. |

## Configuración recomendada en GitLab y Render

1. Crear o elegir el repositorio GitLab que Render tiene conectado.
2. Crear un token en GitLab con permisos para hacer `push` al repositorio.
3. Cargar los secretos anteriores en GitHub.
4. Verificar que Render esté conectado al branch `main` del repositorio GitLab.
5. Mergear un Pull Request en GitHub o ejecutar manualmente el workflow **Mirror to GitLab**.
6. Confirmar que GitLab recibió el commit y que Render inició el deploy.

## Notas operativas

- El mirror asume que GitHub es la fuente de verdad para `main`.
- Evitar commits directos en `main` dentro de GitLab. Si GitLab recibe cambios manuales que no existen en GitHub, el siguiente mirror puede fallar para proteger esos cambios.
- Si el branch de producción en GitLab no se llama `main`, cambiar `HEAD:main` en el workflow por el nombre correspondiente.
