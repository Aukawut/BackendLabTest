const mongoose = require("mongoose")
const  bcrypt = require("bcrypt")
const connectDB = async () => {
  try {
   
    await mongoose.connect(`${process.env.URL_MONGO}`,{
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("DB Connected!")  
  } catch (err) {
    console.log(err)
  }
}
module.exports = connectDB