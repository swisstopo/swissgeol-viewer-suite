import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { CognitoIdentityCredentials } from '@aws-sdk/credential-provider-cognito-identity';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Resource } from 'cesium';
import { SessionService } from 'src/features/session';

interface Options {
  bucket: string;
  key: string;
}

export default class S3Resource extends Resource {
  private readonly bucket: string;
  private readonly sessionService = SessionService.get();

  constructor(options: Options) {
    super({ url: options.key });
    this.bucket = options.bucket;
  }

  clone(result) {
    if (!result) {
      result = new S3Resource({
        key: this.url,
        bucket: this.bucket,
      });
    }
    return result;
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

  private getSignedUrl(
    credentials: CognitoIdentityCredentials,
  ): Promise<string> {
    const client = new S3Client({
      region: 'eu-west-1',
      credentials,
    });
    const options = {
      Bucket: this.bucket,
      Key: extractKeyFromUrl(this.url),
    };
    const command = new GetObjectCommand(options);
    return getSignedUrl(client, command);
  }
}

function extractKeyFromUrl(val: string): string {
  try {
    const url = new URL(val);
    // remove the first '/' from the path
    return url.pathname.slice(1);
  } catch (_err) {
    return val;
  }
}
