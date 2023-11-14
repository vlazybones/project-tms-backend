const mysql = require("mysql");
const con = require("../config/database_connection");
const bcrypt = require("bcryptjs");
const catchAsyncErrors = require("../middlewares/catchAsyncErrors");
const ErrorHandler = require("../utils/errorHandler");
const transporter = require("../config/email_connection");

// checkgroup function
function checkGroup(userid, groupname) {
  let sqlquery =
    "select a.groupname, a.username, b.activestatus from ugroup a join user b ON a.username = b.username WHERE b.username= ? AND a.groupname= ? AND b.activestatus = 1";
  const params = [userid, groupname];

  const data = new Promise((resolve, reject) => {
    con.query(sqlquery, params, function (err, result) {
      if (err) {
        res.status(200).json({
          result: "KEE016",
        });
        //throw err;
      } else if (result.length === 1) {
        resolve(true);
      }
      resolve(false);
    });
  });
  return data;
}

exports.authenticateUser = catchAsyncErrors(async (req, res, next) => {
  const { Username, Password } = req.body;
  let checkUserExists = "select * from user where username = ?";

  const params = [Username];

  con.query(checkUserExists, params, function (err, result, fields) {
    if (err) {
      console.log("authenticateUser error: " + err);
      res.status(200).json({
        result: "KEE016",
      });
    } else if (result.length === 0) {
      res.status(200).json({
        result: "KEE010",
      });
    } else if (result.length !== 0) {
      let hashedPw = result[0].upassword;
      let response = bcrypt.compareSync(Password, hashedPw);

      if (response === false) {
        res.status(200).json({
          result: "KEE010",
        });
      } else if (response === true && result[0].activestatus === 1) {
        next();
      } else {
        res.status(200).json({
          result: "KEE010",
        });
      }
    }
  });
});

exports.CreateTask = catchAsyncErrors(async (req, res, next) => {
  const { Username, Password, Task_app_Acronym, Task_name, Task_description, Task_plan } = req.body;

  const checkPlanTaskName = /^[^\s][\x00-\x7F]*$/;
  const checkAppAcronym = new RegExp("^[a-zA-Z]+$");

  //4 mandatory fields
  if (!Username || !Password || !Task_app_Acronym || !Task_name) {
    res.status(200).json({
      result: "KEE015",
    });
  } else if (
    !checkPlanTaskName.test(Task_name) ||
    (Task_plan && !checkPlanTaskName.test(Task_plan)) ||
    !checkAppAcronym.test(Task_app_Acronym)
  ) {
    res.status(200).json({
      result: "KEE012",
    });
  } else {
    const checkRightsToCreate = "select app_permit_create from application where app_acronym = ?";
    const params = [Task_app_Acronym];

    con.query(checkRightsToCreate, params, async function (err, result, fields) {
      if (err) {
        console.log("checkIfTaskExist 1st err: " + err);
        res.status(200).json({
          result: "KEE016",
        });
      } else if (result.length === 1) {
        if (!(await checkGroup(Username, result[0].app_permit_create))) {
          res.status(200).json({
            result: "KEE011",
          });
        } else {
          // check if the plan exists
          const checkPlanExist =
            "select * from plan where plan_MVP_name = ? AND plan_app_acronym = ?";
          const params = [Task_plan, Task_app_Acronym];

          con.query(checkPlanExist, params, function (err, result, fields) {
            if (err) {
              console.log("createNewTask 2nd query error: " + err);
              res.status(200).json({
                result: "KEE016",
              });
            } else if (result.length === 1) {
              // fields for formatting
              let formattedNotes = "";
              let formattedState = "";
              let formattedDateforNotes = "";
              let date = "";
              let formattedID = "";
              let appRNumber = "";
              let updateRNumber = "";
              let formattedDateForSQL = "";
              let formattedTaskAppAcronym = Task_app_Acronym.toLowerCase();

              // get the appRNumber first. add +1 if query successful
              const getRNumber = "SELECT app_rnumber FROM application WHERE app_acronym = ?";
              const params = [formattedTaskAppAcronym];

              con.query(getRNumber, params, function (err, result, fields) {
                if (err) {
                  console.log("createNewTask 1st query error: " + err);
                  res.status(200).json({
                    result: "KEE016",
                  });
                } else if (result.length === 1) {
                  appRNumber = result[0].app_rnumber;

                  console.log("apprRnum: " + appRNumber);
                  // edit each field first before storing

                  // set taskState to open on creation
                  formattedState = "Open";

                  // set date to correct format
                  date = new Date();
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
                    Task_name +
                    " created by " +
                    Username +
                    " on " +
                    formattedDateforNotes +
                    " in " +
                    formattedState +
                    " state.";

                  // set date to sql format
                  formattedDateForSQL = date;

                  // format task ID generated
                  // task-id using the format of [application_acronym]_[running number].
                  formattedID = formattedTaskAppAcronym + "_" + appRNumber;

                  const addNewTask =
                    "INSERT into task (task_name, task_description, task_notes, task_id, task_plan, task_app_acronym, task_state, task_creator, task_owner, task_createDate) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";

                  const params = [
                    Task_name,
                    Task_description,
                    formattedNotes,
                    formattedID,
                    Task_plan,
                    formattedTaskAppAcronym,
                    formattedState,
                    Username,
                    Username,
                    formattedDateForSQL,
                  ];
                  // conquery here
                  con.query(addNewTask, params, function (err, result, fields) {
                    if (err) {
                      console.log("createNewTask 3rd query error: " + err);
                      //throw err;
                      res.status(200).json({
                        result: "KEE016",
                      });
                    } else {
                      //  once succsesful, another query to add app r number + 1.
                      updateRNumber = appRNumber + 1;
                      const updateRNumberDB =
                        "UPDATE application SET app_rnumber = ? WHERE app_acronym = ?";
                      const params = [updateRNumber, formattedTaskAppAcronym];

                      con.query(updateRNumberDB, params, function (err, result, fields) {
                        if (err) {
                          console.log("createNewTask 4th query error: " + err);
                          //throw err;
                          res.status(200).json({
                            result: "KEE016",
                          });
                        } else {
                          res.status(200).json({
                            Task_id: formattedID,
                          });
                        }
                      });
                    }
                  });
                }
              });
            } else {
              res.status(200).json({ result: "KEE014" });
            }
          });
        }
      } else {
        res.status(200).json({
          result: "KEE013",
        });
      }
    });
  }
});

exports.GetTaskbyState = catchAsyncErrors(async (req, res, next) => {
  const { Username, Password, Task_state, Task_app_Acronym } = req.body;

  let checkStateAndAppName = new RegExp("^[a-zA-Z]+$");

  //4 mandatory fields
  if (!Username || !Password || !Task_app_Acronym || !Task_state) {
    res.status(200).json({
      result: "KEE015",
    });
  } else if (Username && Password && Task_app_Acronym && Task_state) {
    if (!checkStateAndAppName.test(Task_state) || !checkStateAndAppName.test(Task_app_Acronym)) {
      res.status(200).json({
        result: "KEE012",
      });
    } else {
      let formattedTaskAppAcronym = Task_app_Acronym.toLowerCase();

      const getTaskByStateInApp =
        "SELECT *, DATE_FORMAT(task_createDate, '%Y-%m-%d') AS task_createDate FROM task WHERE task_app_acronym = ? AND BINARY task_state = ?";
      const params = [formattedTaskAppAcronym, Task_state];
      const taskStates = ["Open", "toDo", "Doing", "Done", "Closed"];

      if (!taskStates.includes(Task_state)) {
        res.status(200).json({
          result: "KEE012",
        });
      } else {
        con.query(getTaskByStateInApp, params, function (err, result, fields) {
          if (err) {
            console.log("GetTaskbyState error: " + err);
            res.status(200).json({
              result: "KEE016",
            });
          } else if (result.length !== 0) {
            res.status(200).json({
              tasklist: result,
            });
          } else if (result.length === 0) {
            res.status(200).json({
              result: "KEE018",
            });
          }
        });
      }
    }
  }
});

exports.PromoteTask2Done = catchAsyncErrors((req, res, next) => {
  const { Username, Password, Task_id, Task_notes } = req.body;

  const checkTaskID = /^[a-zA-Z]+_[1-9]\d*$/;

  let formattedPlan = "";
  let formattedNotes = "";
  let date = "";
  let formattedDate = "";
  let updatedTaskState = "";
  let formattedDateforNotes = "";
  let taskState = "Doing";

  // 3 mandatory fields
  if (!Username || !Password || !Task_id) {
    res.status(200).json({
      result: "KEE015",
    });
  } else {
    // update state, creater, and notes only
    updatedTaskState = "Done";

    // set date to correct format for notes
    date = new Date();
    formattedDateforNotes = date.toLocaleString("en-US", {
      timeZone: "Asia/Singapore",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });

    const checkIfTaskExist = "select * from task where task_id = ?";
    const params = [Task_id];

    con.query(checkIfTaskExist, params, function (err, result, fields) {
      if (err) {
        console.log("checkIfTaskExist q err: " + err);
        res.status(200).json({
          result: "KEE016",
        });
      } else if (result.length === 1) {
        // check rights
        const checkRightsToPromote =
          "select app_permit_doing from application where app_acronym = ?";
        const params = [result[0].task_app_acronym];

        con.query(checkRightsToPromote, params, async function (err, result, fields) {
          if (err) {
            console.log("checkIfTaskExist q err: " + err);
            res.status(200).json({
              result: "KEE016",
            });
          } else if (result.length === 1) {
            if (await checkGroup(Username, result[0].app_permit_doing)) {
              if (!checkTaskID.test(Task_id)) {
                res.status(200).json({
                  result: "KEE012",
                });
              } else {
                // get current notes and then apphend new notes to it
                const getSelectedTaskNotes =
                  "select task_state, task_notes from task where task_id = ? AND task_state = ?";
                const params = [Task_id, taskState];
                con.query(getSelectedTaskNotes, params, function (err, result, fields) {
                  if (err) {
                    console.log("promoteTask first query err: " + err);
                    res.status(200).json({
                      result: "KEE016",
                    });
                  } else if (result.length === 1) {
                    if (Task_notes) {
                      formattedNotes =
                        "Task notes added by " +
                        Username +
                        " on " +
                        formattedDateforNotes +
                        " in " +
                        taskState +
                        " state." +
                        "\n" +
                        "- " +
                        Task_notes +
                        "\n" +
                        "- " +
                        "Task promoted by " +
                        Username +
                        " on " +
                        formattedDateforNotes +
                        " from " +
                        taskState +
                        " state to " +
                        updatedTaskState +
                        " state." +
                        "\n\n" +
                        result[0].task_notes;
                    } else if (Task_notes === "") {
                      formattedNotes =
                        "- " +
                        "Task promoted by " +
                        Username +
                        " on " +
                        formattedDateforNotes +
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
                      "UPDATE task SET task_owner = ?, task_notes = ?, task_state = ? WHERE task_id = ?";
                    const params = [Username, formattedNotes, updatedTaskState, Task_id];

                    con.query(updateTask, params, function (err, result, fields) {
                      if (err) {
                        console.log("updateSelectedTask secnod query err: " + err);
                        res.status(200).json({
                          result: "KEE016",
                        });
                      } else {
                        res.status(200).json({
                          result: true,
                        });
                        sendEmail(Task_id);
                      }
                    });
                  } else if (result.length === 0) {
                    res.status(200).json({
                      result: "KEE017",
                    });
                  }
                });
              }
            } else {
              res.status(200).json({
                result: "KEE011",
              });
            }
          }
        });
      } else if (result.length === 0) {
        res.status(200).json({
          message: "KEE017",
        });
      }
    });
  }
});

function sendEmail(Task_id) {
  console.log("send Email called");

  let taskName = "";

  const gettask = "select * from task where task_id = ?";
  const params = [Task_id];

  con.query(gettask, params, function (err, result, fields) {
    if (err) {
      console.log("sendEmail q err: " + err);
      res.status(200).json({
        result: "KEE016",
      });
    } else if (result.length === 1) {
      taskName = result[0].task_name;
      console.log("taskName: " + taskName);
    }
  });

  const getAllEmailPL =
    "select user.uemail from user LEFT JOIN ugroup ON user.username = ugroup.username where ugroup.groupname = 'projectlead' AND user.uemail IS NOT NULL AND user.uemail <> \"\" ";
  let emailAddress = [];

  con.query(getAllEmailPL, function (err, result, field) {
    if (err) {
      res.status(200).json({
        result: "KEE016",
      });
    } else if (result.length !== 0) {
      for (let i = 0; i < result.length; i++) {
        emailAddress.push(result[i].uemail);
      }

      // setup email data
      const mailOptions = {
        from: "sytem@tms.com",
        to: "",
        subject: "New promoted task: " + taskName,
        text:
          "Dear PL, \n" +
          "There is a new promoted task. \n\nTask name: " +
          taskName +
          ", Task id: " +
          Task_id +
          ". \nTask is now pending your review. \n\nBest Regards, TMS. ",
      };

      // send mail with defined transport object for each recipient
      for (let i = 0; i < emailAddress.length; i++) {
        mailOptions.to = emailAddress[i];
        transporter.sendMail(mailOptions, (error, info) => {
          if (error) {
            console.log("sendEmail error: " + error);
          } else {
            console.log("Email sent~");
          }
        });
      }
    }
  });
}
