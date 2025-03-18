const mongoose = require("mongoose");

function connectDb() {
  try {
    const connecter = mongoose
      .connect(process.env.MONGOURI)
      .then(() => console.log("Connected ✅"));
  } catch (error) {
    console.log(error);
  }
}

module.exports = connectDb;
