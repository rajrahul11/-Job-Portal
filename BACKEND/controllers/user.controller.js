import { User } from "../models/user.model.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import getDataUri from "../utils/datauri.js";
import cloudinary from "../utils/cloudinary.js";

export const register = async (req, res) => {
    try {
        const { fullname, email, phoneNumber, password, role } = req.body;

        // Validation check
        if (!fullname || !email || !phoneNumber || !password || !role) {
            return res.status(400).json({
                message: "All fields are required.",
                success: false,
            });
        }

        const file = req.file;
        // Check if file is provided for profile photo
        if (!file) {
            return res.status(400).json({
                message: "Profile photo is required.",
                success: false,
            });
        }

        const fileUri = getDataUri(file);
        const cloudResponse = await cloudinary.uploader.upload(fileUri.content);

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({
                message: "User already exists with this email.",
                success: false,
            });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        await User.create({
            fullname,
            email,
            phoneNumber,
            password: hashedPassword,
            role,
            profile: {
                profilePhoto: cloudResponse.secure_url,
            },
        });

        return res.status(201).json({
            message: "Account created successfully.",
            success: true,
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            message: "An error occurred while registering.",
            success: false,
        });
    }
};

export const login = async (req, res) => {
    try {
        const { email, password, role } = req.body;

        // Validation check
        if (!email || !password || !role) {
            return res.status(400).json({
                message: "All fields are required.",
                success: false,
            });
        }

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({
                message: "Incorrect email or password.",
                success: false,
            });
        }

        const isPasswordMatch = await bcrypt.compare(password, user.password);
        if (!isPasswordMatch) {
            return res.status(400).json({
                message: "Incorrect email or password.",
                success: false,
            });
        }

        // Check role
        if (role !== user.role) {
            return res.status(400).json({
                message: "Account doesn't exist with the specified role.",
                success: false,
            });
        }

        const tokenData = { userId: user._id };
        const token = jwt.sign(tokenData, process.env.SECRET_KEY, { expiresIn: '1d' });

        const userResponse = {
            _id: user._id,
            fullname: user.fullname,
            email: user.email,
            phoneNumber: user.phoneNumber,
            role: user.role,
            profile: user.profile,
        };

        return res
            .status(200)
            .cookie("token", token, { maxAge: 1 * 24 * 60 * 60 * 1000, httpOnly: true, sameSite: 'strict' })
            .json({
                message: `Welcome back ${user.fullname}`,
                user: userResponse,
                success: true,
            });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            message: "An error occurred while logging in.",
            success: false,
        });
    }
};

export const logout = async (req, res) => {
    try {
        return res
            .status(200)
            .cookie("token", "", { maxAge: 0 })
            .json({
                message: "Logged out successfully.",
                success: true,
            });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            message: "An error occurred while logging out.",
            success: false,
        });
    }
};

export const updateProfile = async (req, res) => {
    try {
        const { fullname, email, phoneNumber, bio, skills } = req.body;
        const file = req.file;

        const userId = req.id; // Middleware authentication
        const user = await User.findById(userId);

        if (!user) {
            return res.status(400).json({
                message: "User not found.",
                success: false,
            });
        }

        // Updating user data
        if (fullname) user.fullname = fullname;
        if (email) user.email = email;
        if (phoneNumber) user.phoneNumber = phoneNumber;
        if (bio) user.profile.bio = bio;

        // Update skills if provided
        if (skills) {
            user.profile.skills = skills.split(",").map(skill => skill.trim());
        }

        // Upload new file if provided
        if (file) {
            const fileUri = getDataUri(file);
            const cloudResponse = await cloudinary.uploader.upload(fileUri.content);
            user.profile.resume = cloudResponse.secure_url; // Save the Cloudinary URL
            user.profile.resumeOriginalName = file.originalname; // Save the original file name
        }

        await user.save();

        const updatedUser = {
            _id: user._id,
            fullname: user.fullname,
            email: user.email,
            phoneNumber: user.phoneNumber,
            role: user.role,
            profile: user.profile,
        };

        return res.status(200).json({
            message: "Profile updated successfully.",
            user: updatedUser,
            success: true,
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            message: "An error occurred while updating the profile.",
            success: false,
        });
    }
};
