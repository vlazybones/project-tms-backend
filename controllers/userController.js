const mysql = require("mysql");
const con = require("../config/database_connection");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const ErrorHandler = require("../utils/errorHandler");
const catchAsyncErrors = require("../middlewares/catchAsyncErrors");
const e = require("express");
const { get } = require("../routes/user");
const transporter = require("../config/email_connection");

// checkgroup function
function checkGroup(userid, groupname) {
  let sqlquery =
    "select a.groupname, a.username, b.activestatus from ugroup a join user b ON a.username = b.username WHERE b.username=? AND a.groupname= ? AND b.activestatus = 1";
  const params = [userid, groupname];

  const data = new Promise((resolve, reject) => {
    con.query(sqlquery, params, function (err, result) {
      if (err) {
        throw err;
      } else if (result.length === 1) {
        resolve(true);
      }
      resolve(false);
    });
  });
  return data;
}

// decode
function decodedUsername(token) {
  let username = "";
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    username = decoded.username;
  } catch (e) {
    username = "jwterror";
  }

  return username;
}

// ================ FOR BOTH ADMIN AND USER =========================
// login into send to db to check for login => /login (for both admin and user)

exports.login = catchAsyncErrors((req, res, next) => {
  const { username, password } = req.body;

  console.log("u/n: " + username);
  console.log("p/w: " + password);

  // verify login from sql
  let sqlquery = "select * from user where username = ? ";
  const params = username;

  con.query(sqlquery, params, function (err, result) {
    if (err) {
      throw err;
    } else if (result.length === 0) {
      return next(new ErrorHandler("No user found", 404));
    } else {
      let hashedPw = result[0].upassword;
      let response = bcrypt.compareSync(password, hashedPw);

      console.log("hashedpw: " + hashedPw);

      if (response === false) {
        console.log("wrong password for user");
        res.status(404).json({
          success: false,
          message: "cannot login",
        });
      } else if (response === true && result[0].activestatus === 1) {
        // if login successful, return jwttoken for loggin user
        const token = jwt.sign({ username: username }, process.env.JWT_SECRET, {
          expiresIn: process.env.JWT_EXPIRES_TIME,
        });

        res.status(200).json({
          success: true,
          message: "login",
          data: result,
          token: token,
          username: username,
        });
      } else {
        res.status(404).json({
          success: true,
          message: "inactive",
        });
      }
    }
  });
});

// getGroups to see which group user is in
exports.getGroup = catchAsyncErrors((req, res, next) => {
  const { username, token } = req.body;

  let sqlquery = "SELECT * FROM ugroup WHERE username='" + username + "'";
  //console.log("sql query: " + sqlquery);
  con.query(sqlquery, function (err, result, fields) {
    if (err) throw err;
    //result length = how many groups in the db.
    if (result.length > 0) {
      console.log(result);
      console.log("success: retrieved groups from selected user in db");

      res.status(200).json({
        success: true,
        message: "getGroups",
        data: result,
      });
    } else if (result.length === 0) {
      res.status(200).json({
        success: true,
        message: "USER DO NOT HAVE ANY GROUPS..",
      });
    }
  });
});

// check authorization (same user making req by checking jwttoken).
exports.isAuthenticatedUser = catchAsyncErrors(async (req, res, next) => {
  const { token } = req.body;

  const username = decodedUsername(token);

  if (username === "jwterror") {
    res.status(200).json({
      success: false,
      message: "jwt error",
    });
  } else {
    next();
  }
});

// ================ FOR ADMIN =========================

//original
// check if admin (check if admin before accessing admin pages)
exports.checkIfAdmin = catchAsyncErrors(async (req, res, next) => {
  const { token } = req.body;

  const username = decodedUsername(token);

  // check if admin
  let admin = await checkGroup(username, "admin");
  if (!admin) {
    return next(new ErrorHandler("Not admin. No access."), 401);
  }

  next();
});

// modified as of 10/04 4:25pm
// check if admin (check if admin before accessing admin pages)
exports.checkUserGroup = catchAsyncErrors(async (req, res, next) => {
  const { token, groupNameToCheck } = req.body;
  const username = decodedUsername(token);
  console.log("groupNameToCheck :" + groupNameToCheck);

  try {
    // check what group
    let userGroup = await checkGroup(username, groupNameToCheck);

    let resData = {
      username: username,
      checkgroupboolean: userGroup,
    };
    res.status(200).json({
      success: true,
      message: "this route is for user management",
      data: resData,
    });
    console.log("usergroup value: " + userGroup);
  } catch (e) {
    console.log("error check user group");
  }
});

// get all users and info => /getUsers (FOR ADMIN)
exports.getUsers = catchAsyncErrors((req, res, next) => {
  const { token, groupNameToCheck } = req.body;
  const username = decodedUsername(token);

  let checkUser = checkGroup(username, groupNameToCheck);

  if (checkUser) {
    //let userLists = [];
    const getUserFromDB =
      "SELECT user.username, NULL AS password, user.uemail, user.activestatus, GROUP_CONCAT((COALESCE(ugroup.groupname, ''))) AS groupname FROM user LEFT JOIN ugroup ON user.username = ugroup.username GROUP BY user.username";
    con.query(getUserFromDB, function (err, result, fields) {
      if (err) throw err;
      //console.log("success: retrieved users from user table in db");
      //console.log(result);

      res.status(200).json({
        success: true,
        message: "this route is for user management",
        data: result, //userLists,
      });
    });
  } else {
    res.status(200).json({
      success: true,
      message: "error",
    });
  }
});

// add user into user table => /adduser (FOR ADMIN)
exports.addUser = catchAsyncErrors(async (req, res, next) => {
  const {
    usernameNewUser,
    passwordNewUser,
    emailNewUser,
    activestatusNewUser,
    selectedOptionsNewUser,
    token,
  } = req.body;

  const username = decodedUsername(token);
  // if admin then run this whole function

  let upassword = await bcrypt.hash(passwordNewUser, 10);
  let activeStatusBoolean = 1;

  if (activestatusNewUser === 0) {
    activeStatusBoolean = 0;
  }

  const checkIfUserExists = "select * from user where username = ? ";

  con.query(checkIfUserExists, usernameNewUser, function (err, result) {
    if (err) {
      throw err;
      //console.log("1: " + err);
    } else if (result.length == 0) {
      let addUserIntoDB;

      if (!emailNewUser) {
        addUserIntoDB =
          "INSERT INTO user (username, upassword, activestatus) VALUES ('" +
          usernameNewUser +
          "', '" +
          upassword +
          "','" +
          activeStatusBoolean +
          "' )";
      } else {
        addUserIntoDB =
          "INSERT INTO user (username, upassword, uemail, activestatus) VALUES ('" +
          usernameNewUser +
          "', '" +
          upassword +
          "', '" +
          emailNewUser +
          "','" +
          activeStatusBoolean +
          "' )";
      }

      con.query(addUserIntoDB, function (err, result, fields) {
        if (err) {
          throw err;
          //console.log("2: " + err);
        } else {
          console.log("success: added new group into user table in db");
          if (selectedOptionsNewUser !== undefined) {
            // add groups to database for this user in a loop
            console.log("selectedOptionsNewUser: " + selectedOptionsNewUser);

            //use the mysql.format() method to format a SQL query string with values from an array.
            for (let i = 0; i < selectedOptionsNewUser.length; i++) {
              const addGroupToUser = "INSERT INTO ugroup (groupname, username) VALUES (?,?)";
              const params = [selectedOptionsNewUser[i], usernameNewUser];

              const query = mysql.format(addGroupToUser, params);

              con.query(query, params, function (err, result, fields) {
                if (err) {
                  console.log("update group error: " + err);
                }
                console.log("added group: " + selectedOptionsNewUser[i]);
              });
            }
            res.status(200).json({
              success: true,
              message: "added group for new user",
            });
          }
        }
      });
    } else if (result.length > 0) {
      res.status(200).json({
        success: false,
        message: "user exist in db",
      });
    }
  });
});

// add group into group table => /addgroup (FOR ADMIN)
exports.addGroup = catchAsyncErrors((req, res, next) => {
  const { groupnameNew, token } = req.body;

  const username = decodedUsername(token);
  // if admin then run this whole function

  let trimmedname = groupnameNew.trim();
  const checkIfGroupExists = "select * from ugroup where groupname = ? ";

  let usernameForSQL = "";

  con.query(checkIfGroupExists, trimmedname, function (err, result) {
    if (err) {
      throw err;
      //console.log("1: " + err);
    } else if (result.length == 0) {
      let addGroupIntoDB = "INSERT INTO ugroup (groupname, username) VALUES (?,?)";

      const params = [trimmedname, usernameForSQL];

      con.query(addGroupIntoDB, params, function (err, result) {
        if (err) {
          throw err;
        }
        console.log("success: added new group into ugroup table in db");

        res.status(200).json({
          success: true,
          message: "group added",
        });
      });
    } else if (result.length > 0) {
      res.status(200).json({
        success: false,
        message: "group exist in db",
      });
    }
  });
});

// getAllGroups for selecting of groups
exports.getAllGroups = catchAsyncErrors((req, res, next) => {
  const { token } = req.body;

  let sqlquery = "SELECT DISTINCT groupname FROM ugroup";

  con.query(sqlquery, function (err, result, fields) {
    if (err) throw err;

    //console.log(result);

    res.status(200).json({
      success: true,
      message: "getAllGroups",
      data: result,
    });
  });
});

//for updating users in user management page
// check sql if password not null and password null
// if pw null, sql update set statemnet w/o pw
// else hash password and set

exports.manageUsers = catchAsyncErrors(async (req, res, next) => {
  const { updateUsername, updatePassword, updateEmail, updateStatus, token } = req.body;

  const username = decodedUsername(token);
  // if admin then run this whole function

  console.log("what is up " + updatePassword);
  let activeStatusBoolean = 1;
  let updateUsers;
  let params;
  let upassword;

  console.log("updateStatusCODE : " + updateStatus);
  if (updateStatus === 0) {
    activeStatusBoolean = 0;
  }

  if (updatePassword) {
    upassword = await bcrypt.hash(updatePassword, 10);
    updateUsers = "UPDATE user SET upassword = ? , uemail = ? , activestatus = ? WHERE username= ?";
    params = [upassword, updateEmail, activeStatusBoolean, updateUsername];
  } else {
    updateUsers = "UPDATE user SET uemail = ? , activestatus = ? WHERE username= ?";
    params = [updateEmail, activeStatusBoolean, updateUsername];
  }

  con.query(updateUsers, params, function (err, result, fields) {
    if (err) throw err;
    console.log("success: update profile into user table in db");
  });

  res.status(200).json({
    success: true,
    message: "this route is to manage users in user management page",
  });
});

// for updating the user group when the admin removes or adds in new group for the user
// /updateGroupsForSelectedUser

exports.updateGroupsForSelectedUser = catchAsyncErrors(async (req, res, next) => {
  const { groupsToUpdateForUser, token, usernameToUpdateForGroup } = req.body;
  //array obj groupsToUpdateForUser
  console.log("groupsToUpdateForUser: " + groupsToUpdateForUser);

  const username = decodedUsername(token);
  // if admin then run this whole function

  if (groupsToUpdateForUser !== undefined) {
    // delete groups for username before adding in their current selected groups
    const deleteGroup = "DELETE FROM ugroup WHERE username=?";

    params = [usernameToUpdateForGroup];

    con.query(deleteGroup, params, function (err, result, fields) {
      if (err) {
        console.log("delete grp err: " + err);
      } else {
        console.log("deleted all group for user: " + usernameToUpdateForGroup);
        // insert new group after deleting
        //use the mysql.format() method to format a SQL query string with values from an array.
        for (let i = 0; i < groupsToUpdateForUser.length; i++) {
          const updateGroup = "INSERT INTO ugroup (groupname, username) VALUES (?,?)";
          const params = [groupsToUpdateForUser[i], usernameToUpdateForGroup];

          const query = mysql.format(updateGroup, params);

          con.query(query, params, function (err, result, fields) {
            if (err) {
              console.log("update group error: " + err);
            } else {
              console.log("added group: " + groupsToUpdateForUser[i]);
            }
          });
        }
      }
      res.status(200).json({
        success: true,
        message: "updated group",
      });
    });
    //end
  } else {
    res.status(200).json({
      success: true,
      message: "undefined",
    });
  }
});

// ================ FOR USER =========================

// edit profile => /editprofile (FOR USER)

exports.editProfile = catchAsyncErrors(async (req, res, next) => {
  const { username, password, email } = await req.body;

  let upassword;
  let editProfileToDB;
  let params;

  if (password === "") {
    editProfileToDB = "UPDATE user SET uemail = ? WHERE username = ?";
    params = [email, username];
  } else if (password !== "") {
    upassword = await bcrypt.hash(password, 10);
    editProfileToDB = "UPDATE user SET upassword= ?, uemail= ? WHERE username= ? ";
    params = [upassword, email, username];
  }

  con.query(editProfileToDB, params, async function (err, result, fields) {
    if (err) {
      throw err;
    }

    res.status(200).json({
      success: true,
      message: "edited profile",
    });
  });
});

// getprofile => method getProfile /getProfile (SINGLE DATA)

exports.getProfile = (req, res, next) => {
  const { username, token } = req.body;

  const getProfileFromDB = "SELECT * FROM user WHERE username = ?";
  const params = [username];

  con.query(getProfileFromDB, params, function (err, result, fields) {
    if (err) throw err;
    console.log(result);
    console.log("getProfile");
    res.status(200).json({
      success: true,
      message: "retrieved profile",
      data: result,
    });
  });
};

// =================================================================================================
// =================================== FOR ASSIGNMENT 2 FUNCTIONS ==================================//

exports.getRoles = catchAsyncErrors(async (req, res, next) => {
  const { token, rolesToCheck } = req.body;
  const username = decodedUsername(token);
  let booleanRoles = [];

  for (let i = 0; i < rolesToCheck.length; i++) {
    booleanRoles.push(await checkGroup(username, rolesToCheck[i]));
  }

  res.status(200).json({
    success: true,
    message: "ok",
    data: booleanRoles,
  });
});

// ======================================== PROJECT LEAD ======================================
// adding new application /addNewApplication

exports.addNewApplication = catchAsyncErrors((req, res, next) => {
  const {
    appAcronym,
    appDescription,
    appRNumber,
    appStartDate,
    appEndDate,
    selectedOptionsPermitCreate,
    selectedOptionsPermitOpen,
    selectedOptionsPermitToDo,
    selectedOptionsPermitDoing,
    selectedOptionsPermitDone,
    token,
  } = req.body;

  let checkAppAcronym = new RegExp("^[a-zA-Z]+$");

  if (!appAcronym || !appRNumber) {
    res.status(200).json({
      success: false,
      message: "failed validation",
    });
  } else {
    // frontend validations for each field
    // check appacronym
    if (appAcronym && !checkAppAcronym.test(appAcronym)) {
      res.status(200).json({
        success: false,
        message: "failed validation",
      });
    } else {
      /*
      console.log("appAcronym: " + appAcronym);
      console.log("appDescription: " + appDescription);
      console.log("appRNumber: " + appRNumber);
      console.log("appStartDate: " + appStartDate);
      console.log("appEndDate: " + appEndDate);
      console.log("selectedValuesPermitOpen: " + selectedValuesPermitOpen);
      console.log("selectedValuesPermitToDo: " + selectedValuesPermitToDo);
      console.log("selectedValuesPermitDoing: " + selectedValuesPermitDoing);
      console.log("selectedValuesPermitDone: " + selectedValuesPermitDone);
    */
      let selectedValuesPermitCreate = "";
      let selectedValuesPermitOpen = "";
      let selectedValuesPermitToDo = "";
      let selectedValuesPermitDoing = "";
      let selectedValuesPermitDone = "";

      let formattedappStartDate = "";
      let formattedappEndDate = "";

      if (!appStartDate && appEndDate) {
        formattedappStartDate = null;
        formattedappEndDate = appEndDate;
      }
      if (!appEndDate && appStartDate) {
        formattedappEndDate = null;
        formattedappStartDate = appStartDate;
      }
      if (appStartDate && appEndDate) {
        formattedappStartDate = appStartDate;
        formattedappEndDate = appEndDate;
      }
      if (!appStartDate && !appEndDate) {
        formattedappStartDate = null;
        formattedappEndDate = null;
      }

      if (selectedOptionsPermitCreate) {
        selectedValuesPermitCreate = selectedOptionsPermitCreate.value;
      }

      if (selectedOptionsPermitOpen) {
        selectedValuesPermitOpen = selectedOptionsPermitOpen.value;
      }
      if (selectedOptionsPermitToDo) {
        selectedValuesPermitToDo = selectedOptionsPermitToDo.value;
      }
      if (selectedOptionsPermitDoing) {
        selectedValuesPermitDoing = selectedOptionsPermitDoing.value;
      }
      if (selectedOptionsPermitDone) {
        selectedValuesPermitDone = selectedOptionsPermitDone.value;
      }

      // check if app acronym exist in database first

      const checkApplicationExist = "SELECT app_acronym FROM application WHERE app_acronym = ?";
      const params = [appAcronym];
      con.query(checkApplicationExist, params, function (err, result, fields) {
        if (err) {
          console.log("checkApplicationExist error: " + err);
        }
        //if result = 1
        if (result.length === 1) {
          res.status(200).json({
            success: false,
            message: "appacronym exist",
          });
        } else {
          // insert values into application table

          const insertNewApplication =
            "INSERT into application (app_acronym, app_description, app_rnumber, app_startdate, app_enddate, app_permit_create, app_permit_open, app_permit_todo, app_permit_doing, app_permit_done) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";

          const params = [
            appAcronym,
            appDescription,
            appRNumber,
            formattedappStartDate,
            formattedappEndDate,
            selectedValuesPermitCreate,
            selectedValuesPermitOpen,
            selectedValuesPermitToDo,
            selectedValuesPermitDoing,
            selectedValuesPermitDone,
          ];

          con.query(insertNewApplication, params, function (err, result, fields) {
            if (err) {
              console.log("insertNewApplication error: " + err);
              res.status(200).json({
                success: false,
                message: "failed to add",
              });
            } else {
              res.status(200).json({
                success: true,
                message: "new application created",
              });
            }
          });
        }
      });
    }
  }
});

// fetching all applications in the database
exports.getAllApplication = catchAsyncErrors((req, res, next) => {
  const { token } = req.body;
  const getAllApps = "SELECT app_acronym FROM application";

  con.query(getAllApps, function (err, result, fields) {
    if (err) {
      console.log("getAllApps error: " + err);
    } else {
      res.status(200).json({
        success: true,
        message: "all apps fetched",
        data: result,
      });
    }
  });
});

//fetching application selected to edit
exports.getEditApplication = catchAsyncErrors((req, res, next) => {
  // get the appacronym
  const { app_acronym, token } = req.body;

  const getEditApp =
    "SELECT *, IFNULL(DATE_FORMAT(app_startdate, '%Y-%m-%d'), '') AS app_startdate, IFNULL(DATE_FORMAT(app_enddate, '%Y-%m-%d'), '') AS app_enddate FROM application WHERE app_acronym = ?";
  const params = [app_acronym];

  con.query(getEditApp, params, function (err, result, fields) {
    if (err) {
      console.log("getEditApplication error: " + err);
    } else if (result.length === 1) {
      res.status(200).json({
        success: true,
        message: "getEditApplication fetched",
        data: result,
      });
      //console.log(result);
    }
  });
});

// update the application. route-> /updateApplication

exports.updateSelectedApplication = catchAsyncErrors((req, res, next) => {
  const {
    appAcronym,
    appDescription,
    appRNumber,
    appStartDate,
    appEndDate,
    selectedOptionsPermitCreate,
    selectedOptionsPermitOpen,
    selectedOptionsPermitToDo,
    selectedOptionsPermitDoing,
    selectedOptionsPermitDone,
    token,
  } = req.body;

  let selectedValuesPermitCreate = "";
  let selectedValuesPermitOpen = "";
  let selectedValuesPermitToDo = "";
  let selectedValuesPermitDoing = "";
  let selectedValuesPermitDone = "";

  let formattedappStartDate = "";
  let formattedappEndDate = "";

  if (!appStartDate && appEndDate) {
    formattedappStartDate = null;
    formattedappEndDate = appEndDate;
  }
  if (!appEndDate && appStartDate) {
    formattedappEndDate = null;
    formattedappStartDate = appStartDate;
  }
  if (appStartDate && appEndDate) {
    formattedappStartDate = appStartDate;
    formattedappEndDate = appEndDate;
  }
  if (!appStartDate && !appEndDate) {
    formattedappStartDate = null;
    formattedappEndDate = null;
  }

  if (selectedOptionsPermitCreate) {
    selectedValuesPermitCreate = selectedOptionsPermitCreate.value;
  }
  if (selectedOptionsPermitOpen) {
    selectedValuesPermitOpen = selectedOptionsPermitOpen.value;
  }
  if (selectedOptionsPermitToDo) {
    selectedValuesPermitToDo = selectedOptionsPermitToDo.value;
  }
  if (selectedOptionsPermitDoing) {
    selectedValuesPermitDoing = selectedOptionsPermitDoing.value;
  }
  if (selectedOptionsPermitDone) {
    selectedValuesPermitDone = selectedOptionsPermitDone.value;
  }

  // update application
  const updateApplication =
    "UPDATE application SET app_description = ?, app_startdate = ?, app_enddate = ?, app_permit_create = ?, app_permit_open = ?, app_permit_todo = ?, app_permit_doing = ?, app_permit_done = ? WHERE app_acronym = ?";
  const params = [
    appDescription,
    formattedappStartDate,
    formattedappEndDate,
    selectedValuesPermitCreate,
    selectedValuesPermitOpen,
    selectedValuesPermitToDo,
    selectedValuesPermitDoing,
    selectedValuesPermitDone,
    appAcronym,
  ];

  /*
  console.log("appDescription: " + appDescription);
  console.log("formattedappStartDate: " + formattedappStartDate);
  console.log("formattedappEndDate: " + formattedappEndDate);
  console.log("selectedValuesPermitOpen: " + selectedValuesPermitOpen);
  console.log("selectedValuesPermitToDo: " + selectedValuesPermitToDo);
  console.log("selectedValuesPermitDoing: " + selectedValuesPermitDoing);
  console.log("selectedValuesPermitDone: " + selectedValuesPermitDone);
  console.log("appAcronym: " + appAcronym);
  */

  con.query(updateApplication, params, function (err, result, fields) {
    if (err) {
      console.log("updateApplication error: " + err);
      res.status(200).json({
        success: false,
        message: "failed to update",
      });
    } else {
      res.status(200).json({
        success: true,
        message: "updated",
      });
    }
  });
});

// ================================ pm ================================
// add new plan into plan table in db => route: /addNewPlan

exports.addNewPlan = catchAsyncErrors((req, res, next) => {
  const { planMVPname, planStartDate, planEndDate, acronymKanban, planColor, token } = req.body;

  let formattedplanStartDate = "";
  let formattedplanEndDate = "";

  if (!planMVPname) {
    res.status(200).json({
      success: false,
      message: "validation error",
    });
  } else if (!planStartDate || !planEndDate) {
    res.status(200).json({
      success: false,
      message: "validation error",
    });
  }

  if (!planStartDate && planEndDate) {
    formattedplanStartDate = null;
    formattedplanEndDate = planEndDate;
  }
  if (!planEndDate && planStartDate) {
    formattedplanEndDate = null;
    formattedplanStartDate = planStartDate;
  }
  if (planEndDate && planStartDate) {
    formattedplanStartDate = planStartDate;
    formattedplanEndDate = planEndDate;
  }
  if (!planEndDate && !planStartDate) {
    formattedplanStartDate = null;
    formattedplanEndDate = null;
  }

  console.log("formattedplanStartDate: " + formattedplanStartDate);
  console.log("formattedplanEndDate: " + formattedplanEndDate);
  console.log("planStartDate: " + planStartDate);
  console.log("planEndDate: " + planEndDate);

  const checkIfPlanExistInApp =
    "select plan_MVP_name from plan where plan_app_acronym = ? AND plan_MVP_name = ?";

  const params = [acronymKanban, planMVPname];

  con.query(checkIfPlanExistInApp, params, function (err, result, fields) {
    if (err) {
      console.log("checkIfPlanExistInApp error: " + err);
    } else {
      if (result.length === 1) {
        res.status(200).json({
          success: false,
          message: "mvpname exists",
        });
      } else if (result.length === 0) {
        const addNewPlanToDB =
          "INSERT INTO plan (plan_MVP_name, plan_startdate, plan_enddate, plan_app_acronym, plan_color) VALUES (?, ?, ?, ?, ?)";

        const params = [
          planMVPname,
          formattedplanStartDate,
          formattedplanEndDate,
          acronymKanban,
          planColor,
        ];
        con.query(addNewPlanToDB, params, function (err, result, fields) {
          if (err) {
            console.log("addNewPlan error: " + err);
            res.status(200).json({
              success: true,
              message: "add plan failed",
            });
          } else {
            res.status(200).json({
              success: true,
              message: "added new plan",
            });
          }
        });
      }
    }
  });
});

// get all plans to show in the selected application

exports.getAllPlans = catchAsyncErrors((req, res, next) => {
  const { acronymKanban, token } = req.body;

  const getAllPlansInSelectedApp = "SELECT * FROM plan where plan_app_acronym = ? ";
  const params = [acronymKanban];

  con.query(getAllPlansInSelectedApp, params, function (err, result, fields) {
    if (err) {
      console.log("getAllPlans error: " + err);
    } else {
      if (result.length !== 0) {
        res.status(200).json({
          success: true,
          message: "data retrieved",
          data: result,
        });
      } else if (result.length == 0) {
        res.status(200).json({
          success: true,
          message: "no plans",
        });
      }
    }
  });
});

// get selected plan to edit
exports.getEditPlan = catchAsyncErrors((req, res, next) => {
  const { plan_MVP_name, acronymKanban, token } = req.body;

  const getSelectedPlan =
    "SELECT *, IFNULL(DATE_FORMAT(plan_startdate, '%Y-%m-%d'), '') AS plan_startdate, IFNULL(DATE_FORMAT(plan_enddate, '%Y-%m-%d'), '') AS plan_enddate FROM plan WHERE plan_MVP_name = ? AND plan_app_acronym = ?";
  const params = [plan_MVP_name, acronymKanban];

  con.query(getSelectedPlan, params, function (err, result, fields) {
    if (err) {
      console.log("getEditPlan error: " + err);
    } else if (result.length === 1) {
      res.status(200).json({
        success: true,
        message: "getEditPlan fetched",
        data: result,
      });
    }
  });
});

// update plan in db

exports.updateSelectedPlan = catchAsyncErrors((req, res, next) => {
  const { planMVPname, planStartDate, planEndDate, acronymKanban, planColor, token } = req.body;

  let formattedappStartDate = "";
  let formattedappEndDate = "";

  if (!planStartDate || !planEndDate) {
    res.status(200).json({
      success: false,
      message: "validation error",
    });
  }

  if (!planStartDate && planEndDate) {
    formattedappStartDate = null;
    formattedappEndDate = planEndDate;
  }
  if (!planEndDate && planStartDate) {
    formattedappEndDate = null;
    formattedappStartDate = planStartDate;
  }
  if (planStartDate && planEndDate) {
    formattedappStartDate = planStartDate;
    formattedappEndDate = planEndDate;
  }
  if (!planStartDate && !planEndDate) {
    formattedappStartDate = null;
    formattedappEndDate = null;
  }

  const updateSelectedPlan =
    "UPDATE plan SET plan_startdate = ?, plan_enddate = ?, plan_color = ? WHERE plan_MVP_name = ? AND plan_app_acronym = ?";

  const params = [
    formattedappStartDate,
    formattedappEndDate,
    planColor,
    planMVPname,
    acronymKanban,
  ];

  con.query(updateSelectedPlan, params, function (err, result, fields) {
    if (err) {
      console.log("updateSelectedPlan error: " + err);
      res.status(200).json({
        success: false,
        message: "failed to update",
      });
    } else {
      res.status(200).json({
        success: true,
        message: "updated",
      });
    }
  });
});

// create new task to add into db
exports.createNewTask = catchAsyncErrors((req, res, next) => {
  const {
    taskName,
    taskDescription,
    taskNotes,
    taskID,
    selectedPlanForTask,
    taskAppAcronym,
    taskState,
    taskCreator,
    taskOwner,
    acronymKanban,
    username,
    taskCreateDate,
    token,
  } = req.body;

  // declare fields that require formatting before storing into db
  // The notes: a. logon userid, b. current state, c. date & timestamp.

  let formattedNotes = "";
  let formattedState = "";
  let formattedDateforNotes = "";
  let date = "";
  let formattedSelectedPlan = "";
  let formattedID = "";
  let appRNumber = "";
  let formattedCreator = username;
  let formattedTaskOwner = username;
  let updateRNumber = "";
  let formattedDateForSQL = "";

  // get the appRNumber first. then once this query runs, add +1.
  const getRNumber = "SELECT app_rnumber FROM application WHERE app_acronym = ?";
  const params = [acronymKanban];

  con.query(getRNumber, params, function (err, result, fields) {
    if (err) {
      console.log("createNewTask 1st query error: " + err);
    } else if (result.length === 1) {
      appRNumber = result[0].app_rnumber;
      // edit each field first before storing

      // set taskState to open on creation
      formattedState = "Open";

      // set date to correct format
      date = new Date(taskCreateDate);
      formattedDateforNotes = date.toLocaleString("en-US", {
        timeZone: "Asia/Singapore",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });

      // edit task notes to set the fields required upon creation
      formattedNotes =
        "Task " +
        taskName +
        " created by " +
        username +
        " on " +
        formattedDateforNotes +
        " in " +
        formattedState +
        " state.";

      // edit plann get value
      if (selectedPlanForTask) {
        formattedSelectedPlan = selectedPlanForTask.value;
      }

      // set date to sql format
      date = new Date(taskCreateDate);
      formattedDateForSQL = date;

      // format task ID generated
      // task-id using the format of [application_acronym]_[running number].
      formattedID = acronymKanban + "_" + appRNumber;

      /*
      console.log("taskName: " + taskName);
      console.log("taskDescription: " + taskDescription);
      console.log("selectedPlanForTask: " + selectedPlanForTask);
      console.log("acronymKanban: " + acronymKanban);
      console.log("username: " + username);
      console.log("formattedNotes: " + formattedNotes);
      console.log("formattedDateforNotes: " + formattedDateforNotes);
      console.log("formattedSelectedPlan: " + formattedSelectedPlan);
      console.log("formattedID: " + formattedID);
      console.log("formattedCreator: " + formattedCreator);
      console.log("formattedTaskOwner: " + formattedTaskOwner);
      */

      const addNewTask =
        "INSERT into task (task_name, task_description, task_notes, task_id, task_plan, task_app_acronym, task_state, task_creator, task_owner, task_createDate) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";

      const params = [
        taskName,
        taskDescription,
        formattedNotes,
        formattedID,
        formattedSelectedPlan,
        acronymKanban,
        formattedState,
        formattedCreator,
        formattedTaskOwner,
        formattedDateForSQL,
      ];
      // conquery here
      con.query(addNewTask, params, function (err, result, fields) {
        if (err) {
          console.log("createNewTask 2nd query error: " + err);
        } else {
          //  once succsesful, another query to add app r number + 1.
          updateRNumber = appRNumber + 1;
          const updateRNumberDB = "UPDATE application SET app_rnumber = ? WHERE app_acronym = ?";
          const params = [updateRNumber, acronymKanban];

          con.query(updateRNumberDB, params, function (err, result, fields) {
            if (err) {
              console.log("createNewTask 3rd query error: " + err);
            } else {
              res.status(200).json({
                success: true,
                message: "added",
              });
            }
          });
        }
      });
    }
  });
});

exports.getAllTasks = catchAsyncErrors((req, res, next) => {
  const { acronymKanban, token } = req.body;

  const getAllTasksInSelectedApp =
    "select task.task_name, task.task_description, task.task_notes, task.task_id, task.task_plan, task.task_app_acronym, task.task_state, task.task_creator, task.task_owner, task.task_createDate, plan.plan_color FROM task LEFT JOIN plan ON task.task_plan = plan.plan_MVP_name AND plan.plan_app_acronym = task.task_app_acronym where task_app_acronym = ?";
  const params = [acronymKanban];

  con.query(getAllTasksInSelectedApp, params, function (err, result, fields) {
    if (err) {
      console.log("getAllTasks error: " + err);
    } else {
      if (result.length !== 0) {
        res.status(200).json({
          success: true,
          message: "data retrieved",
          data: result,
        });
      } else if (result.length == 0) {
        res.status(200).json({
          success: true,
          message: "no tasks",
        });
      }
    }
  });
});

// get selected task to edit
exports.getEditTask = catchAsyncErrors((req, res, next) => {
  const { task_id, token } = req.body;

  const getSelectedTask =
    "SELECT *, DATE_FORMAT(task_createDate, '%Y-%m-%d') AS task_createDate from task where task_id = ?";
  const params = [task_id];

  con.query(getSelectedTask, params, function (err, result, fields) {
    if (err) {
      console.log("getEditTask error: " + err);
    } else if (result.length === 1) {
      res.status(200).json({
        success: true,
        message: "getEditTask fetched",
        data: result,
      });
    }
  });
});

// update selected task for edit
exports.updateSelectedTask = catchAsyncErrors((req, res, next) => {
  const { editableTaskNotes, taskID, username, taskState, editDate, selectedPlanForTask, token } =
    req.body;

  let formattedPlan = "";
  let formattedNotes = "";
  let date = "";
  let formattedDate = "";

  console.log("editableTaskNotes: " + editableTaskNotes);
  console.log("taskID: " + taskID);
  console.log("username: " + username);
  console.log("selectedPlanForTask: " + selectedPlanForTask);

  if (selectedPlanForTask) {
    formattedPlan = selectedPlanForTask.value;
  }

  date = new Date(editDate);
  formattedDate = date.toLocaleString("en-US", {
    timeZone: "Asia/Singapore",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  // get current notes and then apphend new notes to it
  const getSelectedTaskNotes = "select task_notes from task where task_id = ?";
  const params = [taskID];

  con.query(getSelectedTaskNotes, params, function (err, result, fields) {
    if (err) {
      console.log("updateSelectedTask first query err: " + err);
      res.status(200).json({
        success: false,
        message: "failed to update",
      });
    } else if (result.length === 1) {
      if (editableTaskNotes) {
        formattedNotes =
          editableTaskNotes +
          "\n" +
          "- " +
          "Task notes added by " +
          username +
          " on " +
          formattedDate +
          " in " +
          taskState +
          " state." +
          "\n\n" +
          result[0].task_notes;
      } else if (editableTaskNotes === "") {
        formattedNotes = result[0].task_notes;
      }

      // update after apphending the notes
      const updateTask =
        "UPDATE task SET task_plan = ?, task_owner = ?, task_notes = ? WHERE task_id = ?";
      const params = [formattedPlan, username, formattedNotes, taskID];

      con.query(updateTask, params, function (err, result, fields) {
        if (err) {
          console.log("updateSelectedTask secnod query err: " + err);
          res.status(200).json({
            success: false,
            message: "failed to update",
          });
        } else {
          res.status(200).json({
            success: true,
            message: "updated task",
          });
        }
      });
    }
  });
});

exports.checkAuthorization = catchAsyncErrors(async (req, res, next) => {
  const { username, permitgrouptocheck, token } = req.body;

  let ifAuthorised = await checkGroup(username, permitgrouptocheck);

  if (ifAuthorised) {
    res.status(200).json({
      success: true,
      message: "true",
    });
  } else {
    res.status(200).json({
      success: true,
      message: "false",
    });
  }
});

exports.promoteTask = catchAsyncErrors((req, res, next) => {
  const {
    editableTaskNotes,
    taskID,
    username,
    selectedPlanForTask,
    taskState,
    promoteDate,
    token,
  } = req.body;

  console.log("editableTaskNotes: " + editableTaskNotes);
  console.log("taskID: " + taskID);
  console.log("username: " + username);
  console.log("selectedPlanForTask: " + selectedPlanForTask);
  console.log("promoteDate: " + promoteDate);

  let formattedPlan = "";
  let formattedNotes = "";
  let date = "";
  let formattedDate = "";
  let updatedTaskState = "";

  switch (taskState) {
    case "Open":
      updatedTaskState = "toDo";
      break;
    case "toDo":
      updatedTaskState = "Doing";
      break;
    case "Doing":
      updatedTaskState = "Done";
      break;
    case "Done":
      updatedTaskState = "Closed";
      break;
  }

  if (selectedPlanForTask) {
    formattedPlan = selectedPlanForTask.value;
  }

  date = new Date(promoteDate);
  formattedDate = date.toLocaleString("en-US", {
    timeZone: "Asia/Singapore",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  // get current notes and then apphend new notes to it
  const getSelectedTaskNotes = "select task_notes from task where task_id = ?";
  const params = [taskID];

  con.query(getSelectedTaskNotes, params, function (err, result, fields) {
    if (err) {
      console.log("promoteTask first query err: " + err);
      res.status(200).json({
        success: false,
        message: "failed to promote",
      });
    } else if (result.length === 1) {
      if (editableTaskNotes) {
        formattedNotes =
          editableTaskNotes +
          "\n" +
          "- " +
          "Task notes added by " +
          username +
          " on " +
          formattedDate +
          " in " +
          taskState +
          " state." +
          "\n" +
          "- " +
          "Task promoted by " +
          username +
          " on " +
          formattedDate +
          " from " +
          taskState +
          " state to " +
          updatedTaskState +
          " state." +
          "\n\n" +
          result[0].task_notes;
      } else if (editableTaskNotes === "") {
        formattedNotes =
          "- " +
          "Task promoted by " +
          username +
          " on " +
          formattedDate +
          " from " +
          taskState +
          " state to " +
          updatedTaskState +
          " state." +
          "\n" +
          result[0].task_notes;
      }

      // update after apphending the notes

      const updateTask =
        "UPDATE task SET task_plan = ?, task_owner = ?, task_notes = ?, task_state = ? WHERE task_id = ?";
      const params = [formattedPlan, username, formattedNotes, updatedTaskState, taskID];

      con.query(updateTask, params, function (err, result, fields) {
        if (err) {
          console.log("updateSelectedTask secnod query err: " + err);
          res.status(200).json({
            success: false,
            message: "failed to promote",
          });
        } else {
          res.status(200).json({
            success: true,
            message: "promoted",
          });
        }
      });
    }
  });
});

exports.demoteTask = catchAsyncErrors((req, res, next) => {
  const { editableTaskNotes, taskID, username, selectedPlanForTask, taskState, demoteDate, token } =
    req.body;

  /*
  console.log("editableTaskNotes: " + editableTaskNotes);
  console.log("taskID: " + taskID);
  console.log("username: " + username);
  console.log("selectedPlanForTask: " + selectedPlanForTask.value);
  console.log("demoteDate: " + demoteDate);
  console.log("TaskState: " + taskState);
  */

  let formattedPlan = "";
  let formattedNotes = "";
  let date = "";
  let formattedDate = "";
  let updatedTaskState = "";

  switch (taskState) {
    case "done":
      updatedTaskState = "doing";
      break;
    case "doing":
      updatedTaskState = "todo";
  }

  if (selectedPlanForTask) {
    formattedPlan = selectedPlanForTask.value;
  }

  date = new Date(demoteDate);
  formattedDate = date.toLocaleString("en-US", {
    timeZone: "Asia/Singapore",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  // get current notes and then apphend new notes to it
  const getSelectedTaskNotes = "select task_notes from task where task_id = ?";
  const params = [taskID];

  con.query(getSelectedTaskNotes, params, function (err, result, fields) {
    if (err) {
      console.log("demoteTask first query err: " + err);
      res.status(200).json({
        success: false,
        message: "failed to demote",
      });
    } else if (result.length === 1) {
      if (editableTaskNotes) {
        formattedNotes =
          editableTaskNotes +
          "\n" +
          "- " +
          "Task notes added by " +
          username +
          " on " +
          formattedDate +
          " in " +
          taskState +
          " state." +
          "\n" +
          "- " +
          "Task demoted by " +
          username +
          " on " +
          formattedDate +
          " from " +
          taskState +
          " state to " +
          updatedTaskState +
          " state." +
          "\n\n" +
          result[0].task_notes;
      } else if (editableTaskNotes === "") {
        formattedNotes =
          "- " +
          "Task demoted by " +
          username +
          " on " +
          formattedDate +
          " from " +
          taskState +
          " state to " +
          updatedTaskState +
          " state." +
          "\n" +
          result[0].task_notes;
      }

      // update after apphending the notes

      const demoteTask =
        "UPDATE task SET task_plan = ?, task_owner = ?, task_notes = ?, task_state = ? WHERE task_id = ?";
      const params = [formattedPlan, username, formattedNotes, updatedTaskState, taskID];

      con.query(demoteTask, params, function (err, result, fields) {
        if (err) {
          console.log("demoteTask secnod query err: " + err);
          res.status(200).json({
            success: false,
            message: "failed to demote",
          });
        } else {
          res.status(200).json({
            success: true,
            message: "demoted",
          });
        }
      });
    }
  });
});

exports.sendEmail = catchAsyncErrors((req, res, next) => {
  const { token } = req.body;

  console.log("send Email called");

  // get email of all project lead
  const getAllEmailPL =
    "select user.uemail from user LEFT JOIN ugroup ON user.username = ugroup.username where ugroup.groupname = 'projectlead' AND user.uemail IS NOT NULL AND user.uemail <> \"\" ";
  let emailAddress = [];

  con.query(getAllEmailPL, function (err, result, field) {
    if (err) {
      console.log("sendEmail error: " + err);
    } else if (result.length !== 0) {
      for (let i = 0; i < result.length; i++) {
        emailAddress.push(result[i].uemail);
      }
      console.log("result length: " + result.length);
      console.log("result: " + result[0].uemail);
      console.log("emailaddresses: " + emailAddress);

      // setup email data
      const mailOptions = {
        from: "sender@example.com",
        to: "",
        subject: "New promoted task",
        text: "There is a new promoted task. Please review.",
      };

      // send mail with defined transport object for each recipient
      for (let i = 0; i < emailAddress.length; i++) {
        mailOptions.to = emailAddress[i];
        transporter.sendMail(mailOptions, (error, info) => {
          if (error) {
            console.log("nani?: " + error);
          } else {
            console.log("info? " + info);
            console.log("Email sent~");
            res.status(200).json({
              success: true,
              message: "email sent",
            });
          }
        });
      }
    }
  });
});
