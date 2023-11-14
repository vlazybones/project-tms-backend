const express = require("express");
const router = express.Router();

//importing a3 controller methods
const {
  authenticateUser,
  CreateTask,
  GetTaskbyState,
  PromoteTask2Done,
} = require("../controllers/a3Controller");

router.route("/CreateTask").post(authenticateUser, CreateTask);
router.route("/GetTaskbyState").post(authenticateUser, GetTaskbyState);
router.route("/PromoteTask2Done").post(authenticateUser, PromoteTask2Done);

module.exports = router;
