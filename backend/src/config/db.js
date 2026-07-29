const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    const isTest = process.env.NODE_ENV === "test";
    const options = isTest ? { dbName: "dynamic-pricing-engine-test" } : {};

    const conn = await mongoose.connect(process.env.MONGO_URL, options);
    
    if (isTest) {
      console.log(`⚠️  TEST DATABASE CONNECTED: ${conn.connection.name} ⚠️`);
    } else {
      console.log(`MongoDB Connected: ${conn.connection.host} (${conn.connection.name})`);
    }
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
