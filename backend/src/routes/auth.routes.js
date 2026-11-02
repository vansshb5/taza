import express from "express";
import {
    registerController,
    loginController,
    getMeController,
    updateMeController,
} from "../controllers/auth.controller.js";
import { validateBody } from "../middleware/validation.middleware.js";
import { authenticate } from "../middleware/auth.middleware.js";

const router = express.Router();

// POST /api/auth/register  → Register new user
// POST /api/auth/login     → Login and receive JWT
// GET  /api/auth/me        → Current authenticated user
// PUT  /api/auth/me        → Update profile details

router.post(
    "/register",
    validateBody(["name", "email", "password"]),
    registerController
);

router.post(
    "/login",
    validateBody(["email", "password"]),
    loginController
);

router.get("/me", authenticate, getMeController);
router.put("/me", authenticate, updateMeController);

export default router;

