export const packages = {
  api: `${process.env.BASE_IMAGE_NAME}-api`,
  app: `${process.env.BASE_IMAGE_NAME}-app`,
  sync: `${process.env.BASE_IMAGE_NAME}-sync`,
};

export const packageType = "container";
