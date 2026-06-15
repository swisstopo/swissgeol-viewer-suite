export interface ClientConfig {
  env: AppEnv;
  version: string;
  ionDefaultAccessToken: string;
  gstUrl: string;
  auth: {
    cognito_client_id: string;
    cognito_pool_id: string;
    cognito_identity_pool_id: string;
    cognito_aws_region: string;
  };
}

export enum AppEnv {
  Local = 'local',
  Dev = 'dev',
  Int = 'int',
  Prod = 'prod',
}
