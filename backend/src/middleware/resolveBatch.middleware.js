import Batch from "../models/Batch.js";
import { sendError } from "../utils/response.js";

/**
 * Middleware for Express router.param() to resolve a :batchId or :id 
 * parameter to the internal MongoDB _id if a batchCode was provided instead.
 */
export const resolveBatchParam = async (req, res, next, idValue, paramName) => {
    try {
        if (!idValue) return next();

        // If it's already a valid 24-char hex ObjectId, leave it alone
        if (idValue.match(/^[0-9a-fA-F]{24}$/)) {
            return next();
        }

        // Otherwise assume it's a batchCode
        const batch = await Batch.findOne({ batchCode: idValue }).select("_id");
        if (!batch) {
            return sendError(res, 404, "Batch not found");
        }

        // We can't easily mutate req.params here for the route to see because 
        // the route parses the param again, but wait... 
        // In Express, setting req.params[paramName] inside a router.param callback 
        // actually DOES persist, because Express merges it.
        // Even better, we can just mutate req.params in a normal middleware 
        // if we put it on the route itself.
        
        // Actually, Express param callbacks are intended for this.
        // Wait, Express param callback signature: (req, res, next, id, name)
        // Express doesn't overwrite it if we modify req.params here!
        req.params[paramName] = batch._id.toString();
        next();
    } catch (error) {
        next(error);
    }
};

/**
 * Normal route middleware version, must be added to each route definition:
 * router.get("/:id", resolveBatchIdMiddleware("id"), controller);
 */
export const resolveBatchIdMiddleware = (paramName) => async (req, res, next) => {
    try {
        const idValue = req.params[paramName];
        if (!idValue) return next();

        if (idValue.match(/^[0-9a-fA-F]{24}$/)) {
            return next();
        }

        const batch = await Batch.findOne({ batchCode: idValue }).select("_id");
        if (!batch) {
            return sendError(res, 404, "Batch not found");
        }

        req.params[paramName] = batch._id.toString();
        next();
    } catch (error) {
        next(error);
    }
};
