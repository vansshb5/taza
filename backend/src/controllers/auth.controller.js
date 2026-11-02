import {
    registerUser,
    loginUser,
    getUserProfile,
    updateUserProfile,
} from "../services/auth.service.js";
import { sendSuccess, sendError } from "../utils/response.js";

/**
 * POST /api/auth/register
 * Register a new user account.
 */
export const registerController = async (req, res, next) => {
    try {
        const { name, email, password, role, organization, phone } = req.body;
        const result = await registerUser({
            name,
            email,
            password,
            role,
            organization,
            phone,
        });

        return sendSuccess(res, 201, result, "Account registered successfully.");
    } catch (error) {
        next(error);
    }
};

/**
 * POST /api/auth/login
 * Authenticate with email & password, return user + JWT.
 */
export const loginController = async (req, res, next) => {
    try {
        const { email, password } = req.body;
        const result = await loginUser(email, password);

        return sendSuccess(res, 200, result, "Login successful.");
    } catch (error) {
        next(error);
    }
};

/**
 * GET /api/auth/me
 * Return the authenticated user's profile.
 */
export const getMeController = async (req, res, next) => {
    try {
        const user = await getUserProfile(req.user._id);
        return sendSuccess(res, 200, user);
    } catch (error) {
        next(error);
    }
};

/**
 * PUT /api/auth/me
 * Update the authenticated user's profile details.
 */
export const updateMeController = async (req, res, next) => {
    try {
        const updated = await updateUserProfile(req.user._id, req.body);
        return sendSuccess(res, 200, updated, "Profile updated successfully.");
    } catch (error) {
        next(error);
    }
};

