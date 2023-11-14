use tms; 

create table user (
	username varchar(50) PRIMARY KEY NOT NULL,
    upassword char(60) NOT NULL,
    uemail varchar(255),
    activestatus boolean
);

drop table ugroup;
drop table user;

create table ugroup (
    groupname varchar(50) NOT NULL, 
    username varchar(50) NULL,
    PRIMARY KEY(groupname, username);
);

ALTER USER 'root'@'localhost' IDENTIFIED WITH mysql_native_password BY 'password123';

flush privileges;

select * from user where activestatus = false;

select * from ugroup;
select * from user;


create table application (                  
    app_acronym VARCHAR(50) NOT NULL,
    app_description longtext,
    app_rnumber INT,
    app_startdate DATE,
    app_enddate DATE,
    app_permit_create VARCHAR(50),
    app_permit_open VARCHAR(50),
    app_permit_todo VARCHAR(50), 
    app_permit_doing VARCHAR(50),
    app_permit_done VARCHAR(50),
    PRIMARY KEY(app_acronym)       
);

create table plan (
plan_MVP_name VARCHAR(50) NOT NULL,
plan_startdate DATE, 
plan_enddate DATE,
plan_app_acronym VARCHAR(50),
plan_color CHAR(7),
PRIMARY KEY(plan_MVP_name, plan_app_acronym),
FOREIGN KEY (plan_app_acronym) references application(app_acronym)
); 

create table task (
task_name VARCHAR(50) NOT NULL,
task_description longtext,
task_notes longtext,
task_id VARCHAR(50) NOT NULL, 
task_plan VARCHAR(50),
task_app_acronym VARCHAR(50),
task_state VARCHAR(50),
task_creator VARCHAR(50),
task_owner VARCHAR(50),
task_createDate DATE,
PRIMARY KEY(task_id));