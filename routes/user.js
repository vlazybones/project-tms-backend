const express = require("express");
const router = express.Router();

//importing jobs controller methods
const {
  getUsers,
  addUser,
  addGroup,
  editProfile,
  login,
  manageUsers,
  isAuthenticatedUser,
  checkUserGroup,
  getProfile,
  getGroup,
  getAllGroups,
  updateGroupsForSelectedUser,
  checkIfAdmin,
  addNewApplication,
  getAllApplication,
  getEditApplication,
  updateSelectedApplication,
  addNewPlan,
  getAllPlans,
  getEditPlan,
  updateSelectedPlan,
  createNewTask,
  getAllTasks,
  getEditTask,
  updateSelectedTask,
  checkAuthorization,
  promoteTask,
  demoteTask,
  sendEmail,
  getRoles,
} = require("../controllers/userController");

//Passing the method from controller
//ONLY for admin routes
router.route("/getUsers").post(isAuthenticatedUser, checkIfAdmin, getUsers);
router.route("/adduser").post(isAuthenticatedUser, checkIfAdmin, addUser);
router.route("/addgroup").post(isAuthenticatedUser, checkIfAdmin, addGroup);
router.route("/manageUsers").post(isAuthenticatedUser, checkIfAdmin, manageUsers);
router.route("/getAllGroups").post(isAuthenticatedUser, getAllGroups);
router
  .route("/updateGroupsForSelectedUser")
  .post(isAuthenticatedUser, checkIfAdmin, updateGroupsForSelectedUser);

//user routes
router.route("/editprofile").post(isAuthenticatedUser, editProfile);
router.route("/login").post(login);
router.route("/getProfile").post(isAuthenticatedUser, getProfile);
router.route("/getGroup").post(isAuthenticatedUser, getGroup);
router.route("/verify").post(isAuthenticatedUser, checkUserGroup);

//pl routes (create/edit application)
router.route("/addNewApplication").post(isAuthenticatedUser, addNewApplication);
router.route("/getAllApplication").post(isAuthenticatedUser, getAllApplication);
router.route("/getEditApplication").post(isAuthenticatedUser, getEditApplication);
router.route("/updateApplication").post(isAuthenticatedUser, updateSelectedApplication);

//pl - create tasks
router.route("/createNewTask").post(isAuthenticatedUser, createNewTask);
router.route("/getAllTasks").post(isAuthenticatedUser, getAllTasks);
router.route("/getEditTask").post(isAuthenticatedUser, getEditTask);
router.route("/updateSelectedTask").post(isAuthenticatedUser, updateSelectedTask);

//pm routes(create/edit plan)
router.route("/addNewPlan").post(isAuthenticatedUser, addNewPlan);
router.route("/getAllPlans").post(isAuthenticatedUser, getAllPlans);
router.route("/getEditPlan").post(isAuthenticatedUser, getEditPlan);
router.route("/updateSelectedPlan").post(isAuthenticatedUser, updateSelectedPlan);

//
router.route("/getRoles").post(isAuthenticatedUser, getRoles);
router.route("/checkAuthorization").post(isAuthenticatedUser, checkAuthorization);
router.route("/promoteTask").post(isAuthenticatedUser, promoteTask);
router.route("/demoteTask").post(isAuthenticatedUser, demoteTask);
router.route("/sendEmail").post(isAuthenticatedUser, sendEmail);

module.exports = router;
