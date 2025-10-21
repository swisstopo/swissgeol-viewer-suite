import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { Resource } from 'cesium';
import { CognitoIdentityCredentials } from '@aws-sdk/credential-provider-cognito-identity';
import { SessionService } from 'src/features/session';

function extractKeyFromUrl(val: string): string {
  try {
    const url = new URL(val);
    // remove the first '/' from the path
    return url.pathname.slice(1);
  } catch (_err) {
    return val;
  }
}

export default class AmazonS3Resource extends Resource {
  private readonly bucket: string;
  private readonly region: string;

  private readonly sessionService: SessionService;

  constructor(options: {
    sessionService: SessionService;
    url: string;
    bucket: string;
    region?: string;
  }) {
    super({ url: options.url });

    this.sessionService = options.sessionService;
    this.bucket = options.bucket;
    this.region = options.region || 'eu-west-1';
  }

  clone(result) {
    if (!result) {
      result = new AmazonS3Resource({
        sessionService: this.sessionService,
        url: this.url,
        bucket: this.bucket,
        region: this.region,
      });
    }
    return result;
  }

  getSignedUrl(credentials: CognitoIdentityCredentials): Promise<string> {
    const client = new S3Client({
      region: this.region,
      credentials,
    });
    const options = {
      Bucket: this.bucket,
      Key: extractKeyFromUrl(this.url),
    };
    const command = new GetObjectCommand(options);
    return getSignedUrl(client, command, { expiresIn: 5 });
  }

  _makeRequest(options) {
    const credentials = this.sessionService.cognitoIdentityCredentials;
    if (credentials === null) {
      return;
    }
    return this.getSignedUrl(credentials).then<unknown>((url) => {
      this.url = url;
      return (Resource.prototype as any)._makeRequest.call(this, options);
    });
  }
}
