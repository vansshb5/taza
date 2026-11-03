/**
 * Upload Middleware
 *
 * Multer config for produce-image uploads used by the "Analyze Batch"
 * flow. Uses memory storage (no disk writes) since images are streamed
 * straight through to the Python AI service — Express never needs to
 * persist them.
 */
import multer from "multer";

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB per image
const MAX_FILES = 8;

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
        return cb(new Error(`Unsupported file type '${file.mimetype}' — images only.`));
    }
    cb(null, true);
};

const upload = multer({
    storage,
    fileFilter,
    limits: { fileSize: MAX_FILE_SIZE_BYTES, files: MAX_FILES },
});

// Field name "images" matches what the frontend ImageUploader / analyzeBatch
// FormData appends, and what mlProxy.service.js forwards to Python's
// `images: List[UploadFile] = File(...)` parameter.
const uploadImages = upload.array("images", MAX_FILES);

// Wraps multer so upload problems become clean 4xx responses instead of 500s.
export const uploadBatchImages = (req, res, next) => {
    uploadImages(req, res, (err) => {
        if (!err) return next();
        if (err instanceof multer.MulterError) {
            const messages = {
                LIMIT_FILE_SIZE: [413, `Each image must be ${MAX_FILE_SIZE_BYTES / (1024 * 1024)}MB or smaller.`],
                LIMIT_FILE_COUNT: [422, `At most ${MAX_FILES} images can be uploaded.`],
                LIMIT_UNEXPECTED_FILE: [422, "Unexpected upload field — images must use the field name 'images' (max " + MAX_FILES + ")."],
            };
            const [status, message] = messages[err.code] || [400, err.message];
            return next(Object.assign(new Error(message), { statusCode: status }));
        }
        // fileFilter rejection (non-image)
        return next(Object.assign(new Error(err.message), { statusCode: 415 }));
    });
};

export default upload;
