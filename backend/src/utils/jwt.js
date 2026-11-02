import jwt from "jsonwebtoken";
import env from "../config/env.js";

/**
 * Generate a JWT token for a user payload.
 * @param {object} payload - Typically { id: user._id, role: user.role, email: user.email }
 * @returns {string}
 */
export const generateToken = (payload) => {
    return jwt.sign(payload, env.jwtSecret, {
        expiresIn: env.jwtExpiresIn,
    });
};

/**
 * Verify and decode a JWT token.
 * @param {string} token
 * @returns {object} Decoded payload
 */
export const verifyToken = (token) => {
    return jwt.verify(token, env.jwtSecret);
};

