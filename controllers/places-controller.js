const fs = require('fs');

const { validationResult } = require('express-validator');
const mongoose = require('mongoose');
// const mongooseUniqueValidator = require('mongoose-unique-validator');

const HttpError = require('../models/http-error');
const getCoordsForAddress = require('../util/lacation');
const Place = require('../models/place');
const User = require('../models/user');

const getPlaceById = async (req, res, next) => {
  const placeId = req.params.pid; // { pid: 'p1' }

  let place;

  try {
    // place = Place.findById().exec(); // get a real promise
    place = await Place.findById(placeId);
  } catch (err) {
    const error = new HttpError('Something went wrong, could not find a place.', 500);
    next(error);
    return;
  }

  if (!place) {
    const error = HttpError('Could not find a place for a provided id.', 404);
    next(error);
    return;
  }

  // res.json({ place }); // => { place } => { place: place }
  res.json({ place: place.toObject({ getters: true }) });
};

// function getPlaceById() { ... }
// const getPlaceById = function() { ... }

const getPlacesByUserId = async (req, res, next) => {
  const userId = req.params.uid;

  let places;

  try {
    places = await Place.find({ creator: userId });
  } catch (err) {
    const error = new HttpError('Fatching places failed, please try again later.', 500);
    next(error);
    return;
  }

  if (!places || places.length === 0) {
    next(new HttpError('Could not find places for a provided user id.', 404));
    return;
  }

  res.json({ places: places.map((place) => place.toObject({ getters: true })) });
};

const createPlace = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    // console.log(errors);
    next(new HttpError('Invalid inputs passed, please check your data.', 422));
    return;
  }

  const { title, description, address } = req.body;

  let coordinates;
  try {
    coordinates = await getCoordsForAddress(address);
  } catch (error) {
    next(error);
    return;
  }

  const createdPlace = new Place({
    title,
    description,
    address,
    location: coordinates,
    image: req.file.path,
    creator: req.userData.userId,
  });

  let user;

  try {
    user = await User.findById(req.userData.userId);
  } catch (err) {
    const error = new HttpError('Creating place failed, please try again later.', 500);
    next(error);
    return;
  }

  if (!user) {
    const error = new HttpError('Could not find user for provided id', 404);
    next(error);
    return;
  }

  // console.log(user);

  try {
    const sess = await mongoose.startSession();
    sess.startTransaction();
    await createdPlace.save({ session: sess });
    user.places.push(createdPlace);
    await user.save({ session: sess });
    await sess.commitTransaction();
  } catch (err) {
    const error = new HttpError('Creating place failed, please try again later.', 500);
    next(error);
    return;
  }

  res.status(201).json({ place: createdPlace });
};

const updatePlace = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new HttpError('Invalid inputs passed, please check your data.', 422);
  }

  const { title, description } = req.body;
  const placeId = req.params.pid;

  let place;

  try {
    place = await Place.findById(placeId);
  } catch (err) {
    const error = new HttpError('Something went wrong, could not update place.', 500);
    next(error);
    return;
  }

  if (place.creator.toString() !== req.userData.userId) {
    const error = new HttpError('You are not allowed to edit this place.', 401);
    next(error);
    return;
  }

  place.title = title;
  place.description = description;

  try {
    await place.save();
  } catch (err) {
    const error = new HttpError('Something went wrong, could not update place.', 500);
    next(error);
    return;
  }

  res.status(200).json({ place: place.toObject({ getters: true }) });
};

const deletePlace = async (req, res, next) => {
  const placeId = req.params.pid;

  let place;

  try {
    place = await Place.findById(placeId).populate('creator');
  } catch (err) {
    const error = new HttpError('Something went wrong, could not delete place.', 500);
    next(error);
    return;
  }

  if (!place) {
    const error = new HttpError('Could not find place for this id.', 404);
    next(error);
    return;
  }

  if (place.creator.id !== req.userData.userId) {
    const error = new HttpError('You are not allowed to detete this place.', 401);
    next(error);
    return;
  }

  const imagePath = place.image;

  try {
    const sess = await mongoose.startSession();
    sess.startTransaction();
    await place.remove({ session: sess });
    place.creator.places.pull(place);
    await place.creator.save({ session: sess });
    await sess.commitTransaction();
  } catch (err) {
    const error = new HttpError('Something went wrong, could not delete place.', 500);
    next(error);
    return;
  }

  fs.unlink(imagePath, (err) => {
    console.log(err);
  });

  res.status(200).json({ message: 'Deleted place.' });
};

exports.getPlaceById = getPlaceById;
exports.getPlacesByUserId = getPlacesByUserId;
exports.createPlace = createPlace;
exports.updatePlace = updatePlace;
exports.deletePlace = deletePlace;
