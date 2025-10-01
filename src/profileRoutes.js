const express = require("express");
const router = express.Router();
const { requireAuth } = require("./middleware.auth");
const profileController = require("./profileController");

// Get user profile
router.get("/profile", requireAuth, profileController.getProfile);

// Update profile
router.put("/profile", requireAuth, profileController.updateProfile);

router.put("/profile/personal-details", requireAuth, profileController.updatePersonalDetails);


// Upload avatar
router.post("/profile/avatar", requireAuth, profileController.uploadAvatar);

// Upload cover photo
router.post("/profile/cover", requireAuth, profileController.uploadCover);

// Add experience
router.post("/profile/experience", requireAuth, profileController.addExperience);

// Add education
router.post("/profile/education", requireAuth, profileController.addEducation);

// Add skill
router.post("/profile/skill", requireAuth, profileController.addSkill);

// Add certification
router.post("/profile/certification", requireAuth, profileController.addCertification);

module.exports = router;
