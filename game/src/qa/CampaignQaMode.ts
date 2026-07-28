export const QA_CAMPAIGN_QUERY = 'qaCampaign';
export const QA_CAMPAIGN_STORAGE_NAMESPACE = 'nwd:qa-campaign';
export const isCampaignQaRequested = (search: string): boolean => new URLSearchParams(search).get(QA_CAMPAIGN_QUERY) === '1';
