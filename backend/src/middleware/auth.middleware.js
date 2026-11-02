import { verifyToken } from "../utils/jwt.js";
import User from "../models/User.js";
import { sendError } from "../utils/response.js";

/**
 * Authentication Middleware
 * Validates JWT Bearer token and attaches authenticated User document to req.user.
 */
export const authenticate = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return sendError(
                res,
                401,
                "Authentication required. Please provide a valid Bearer token in the Authorization header."
            );
        }

        const token = authHeader.split(" ")[1];
        if (!token) {
            return sendError(res, 401, "Authentication token missing.");
        }

        let decoded;
        try {
            decoded = verifyToken(token);
        } catch (jwtError) {
            if (jwtError.name === "TokenExpiredError") {
                return sendError(res, 401, "Token has expired. Please sign in again.");
            }
            return sendError(res, 401, "Invalid authentication token.");
        }

        const user = await User.findById(decoded.id);
        if (!user) {
            return sendError(res, 401, "User belonging to this token no longer exists.");
        }

        if (!user.isActive) {
            return sendError(res, 403, "User account has been deactivated.");
        }

        req.user = user;
        next();
    } catch (error) {
        next(error);
    }
};

/**
 * Optional Authentication Middleware
 * If token is present, resolves user; if absent, continues without error.
 */
export const optionalAuthenticate = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith("Bearer ")) {
            const token = authHeader.split(" ")[1];
            if (token) {
                try {
                    const decoded = verifyToken(token);
                    const user = await User.findById(decoded.id);
                    if (user && user.isActive) {
                        req.user = user;
                    }
                } catch {
                    // Ignore token errors for optional auth
                }
            }
        }
        next();
    } catch (error) {
        next(error);
    }
};

/**
 * Role-Based Authorization Middleware
 * Ensures req.user has one of the allowed roles.
 * @param  {...string} roles
 */
export const authorize = (...roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return sendError(res, 401, "Authentication required.");
        }

        // Admin bypasses all role restrictions
        if (req.user.role === "admin") {
            return next();
        }

        if (!roles.includes(req.user.role)) {
            return sendError(
                res,
                403,
                `Forbidden. Role '${req.user.role}' is not authorized to access this resource.`
            );
        }

        next();
    };
};

