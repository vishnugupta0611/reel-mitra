const cloudinary = require("cloudinary").v2;

function configureCloudinary() {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });
}

configureCloudinary();

function isCloudinaryConfigured() {
  const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = process.env;
  return Boolean(
    CLOUDINARY_CLOUD_NAME &&
      CLOUDINARY_API_KEY &&
      CLOUDINARY_API_SECRET &&
      !CLOUDINARY_CLOUD_NAME.startsWith("your_") &&
      !CLOUDINARY_API_KEY.startsWith("your_") &&
      !CLOUDINARY_API_SECRET.startsWith("your_")
  );
}

function generateUploadSignature({ folder, publicId }) {
  configureCloudinary();
  const timestamp = Math.round(Date.now() / 1000);
  const paramsToSign = { timestamp, folder, public_id: publicId };
  const signature = cloudinary.utils.api_sign_request(
    paramsToSign,
    process.env.CLOUDINARY_API_SECRET
  );

  return {
    timestamp,
    signature,
    folder,
    public_id: publicId,
    api_key: process.env.CLOUDINARY_API_KEY,
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  };
}

function uploadBuffer(buffer, { folder = "reelmitra", publicId, resourceType = "auto" }) {
  configureCloudinary();
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, public_id: publicId, resource_type: resourceType },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );
    stream.end(buffer);
  });
}

async function destroyAsset(publicId, resourceType = "image") {
  configureCloudinary();
  return cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
}

module.exports = {
  cloudinary,
  isCloudinaryConfigured,
  generateUploadSignature,
  uploadBuffer,
  destroyAsset,
};
