import User from "../models/User.js";
import { generateToken } from "../utils/jwt.js";
import logger from "../utils/logger.js";

/**
 * Register a new user.
 * @param {object} userData - { name, email, password, role, organization, phone }
 * @returns {object} { user, token }
 */
export const registerUser = async (userData) => {
    const { name, email, password, role, organization, phone } = userData;

    if (!email || !password || !name) {
        throw Object.assign(new Error("Name, email, and password are required."), {
            statusCode: 400,
        });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Check for existing user
    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) {
        throw Object.assign(
            new Error("An account with this email address already exists."),
            { statusCode: 409 }
        );
    }

    // Create user
    const user = await User.create({
        name: name.trim(),
        email: normalizedEmail,
        password,
        role: role || "aggregator",
        organization: organization ? organization.trim() : "",
        phone: phone ? phone.trim() : "",
        lastLogin: new Date(),
    });

    // Generate JWT
    const token = generateToken({
        id: user._id.toString(),
        email: user.email,
        role: user.role,
    });

    logger.info("User registered successfully", {
        userId: user._id,
        email: user.email,
        role: user.role,
    });

    return {
        user,
        token,
    };
};

/**
 * Login an existing user.
 * @param {string} email
 * @param {string} password
 * @returns {object} { user, token }
 */
export const loginUser = async (email, password) => {
    if (!email || !password) {
        throw Object.assign(new Error("Email and password are required."), {
            statusCode: 400,
        });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Retrieve user including the password hash
    const user = await User.findOne({ email: normalizedEmail }).select("+password");
    if (!user) {
        throw Object.assign(new Error("Invalid email or password."), {
            statusCode: 401,
        });
    }

    if (!user.isActive) {
        throw Object.assign(new Error("This account has been deactivated. Please contact support."), {
            statusCode: 403,
        });
    }

    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
        throw Object.assign(new Error("Invalid email or password."), {
            statusCode: 401,
        });
    }

    // Record last login
    user.lastLogin = new Date();
    await user.save();

    // Generate JWT
    const token = generateToken({
        id: user._id.toString(),
        email: user.email,
        role: user.role,
    });

    logger.info("User logged in successfully", {
        userId: user._id,
        email: user.email,
        role: user.role,
    });

    return {
        user,
        token,
    };
};

/**
 * Get profile of a user.
 * @param {string} userId
 */
export const getUserProfile = async (userId) => {
    const user = await User.findById(userId);
    if (!user) {
        throw Object.assign(new Error("User not found."), { statusCode: 404 });
    }
    return user;
};

/**
 * Update user profile details.
 * @param {string} userId
 * @param {object} updates
 */
export const updateUserProfile = async (userId, updates) => {
    const allowed = ["name", "phone", "organization", "role"];
    const filteredUpdates = {};

    for (const key of allowed) {
        if (updates[key] !== undefined) {
            filteredUpdates[key] = updates[key];
        }
    }

    const user = await User.findByIdAndUpdate(userId, filteredUpdates, {
        new: true,
        runValidators: true,
    });

    if (!user) {
        throw Object.assign(new Error("User not found."), { statusCode: 404 });
    }

    return user;
};

