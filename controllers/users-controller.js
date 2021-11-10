const { validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const HttpError = require('../models/http-error');
const User = require('../models/user');

const getUsers = async (req, res, next) => {
  let users;
  try {
    users = await User.find({}, '-password');
  } catch (err) {
    const error = new HttpError('Fetching users failed, please try again later.', 500, err);
    next(error);
    return;
  }

  res.json({ users: users.map((user) => user.toObject({ getters: true })) });
  next();
};

const signup = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    next(new HttpError('Invalid inputs passed, please check your data.', 422));
    return;
  }

  const { name, email, password } = req.body;

  let existingUser;
  try {
    existingUser = await User.findOne({ email });
  } catch (err) {
    const error = new HttpError('Signin up failed, please try again later.', 500, err);
    next(error);
    return;
  }

  if (existingUser) {
    const error = new HttpError('User exits already, please login instead.', 422);
    next(error);
    return;
  }

  // const createdUser = {
  //   id: uuid(),
  //   name,
  //   email,
  //   password,
  // };

  let hashedPassword;
  try {
    hashedPassword = await bcrypt.hash(password, 12);
  } catch (err) {
    const error = new HttpError('Could not create user, please try again.', 500, err);
    next(error);
    return;
  }

  const createdUser = new User({
    name,
    email,
    image: req.file.path,
    password: hashedPassword,
    places: [],
  });

  try {
    await createdUser.save();
  } catch (err) {
    const error = new HttpError('Sining Up failed, plase try again later.', 500, err);
    next(error);
    return;
  }

  let token;
  try {
    token = jwt.sign({ userId: createdUser.id, email: createdUser.email }, process.env.JWT_KEY, {
      expiresIn: process.env.JWT_EXPIRES,
    });
  } catch (err) {
    const error = new HttpError('Sining Up failed, plase try again later.', 500, err);
    next(error);
    return;
  }

  // res.status(201).json({ user: createdUser.toObject({ getters: true }) });
  res.status(201).json({ userId: createdUser.id, email: createdUser.email, token });
};

const login = async (req, res, next) => {
  const { email, password } = req.body;

  let existingUser;
  try {
    existingUser = await User.findOne({ email });
  } catch (err) {
    const error = new HttpError('Logging in failed, please try again later.', 500, err);
    next(error);
    return;
  }

  if (!existingUser) {
    const error = new HttpError('Invalid credentials, could not log you in.', 403);
    next(error);
    return;
  }

  let isValidPassword = false;
  try {
    isValidPassword = await bcrypt.compare(password, existingUser.password);
  } catch (err) {
    const error = new HttpError(
      'Could not log you in, please check your credentials and try again.',
      500,
    );
    next(error);
    return;
  }

  if (!isValidPassword) {
    const error = new HttpError('Invalid credentials, could not log you in.', 403);
    next(error);
    return;
  }

  let token;
  try {
    token = jwt.sign({ userId: existingUser.id, email: existingUser.email }, process.env.JWT_KEY, {
      expiresIn: '1h',
    });
  } catch (err) {
    const error = new HttpError('Logginig in failed, plase try again later.', 500, err);
    next(error);
    return;
  }

  // res.json({
  //   message: 'Logged in!',
  //   user: existingUser.toObject({ getters: true }),
  // });
  res.json({
    userId: existingUser.id,
    email: existingUser.email,
    token,
  });
  next();
};

exports.getUsers = getUsers;
exports.signup = signup;
exports.login = login;
