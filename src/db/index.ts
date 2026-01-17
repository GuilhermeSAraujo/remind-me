import mongoose from "mongoose";
import { env } from "../env";

const connectDB = async () => {
    try {
        const conn = await mongoose.connect(env.MONGODB_URI);
        console.log(`[DB] MongoDB Connected: ${conn.connection.host}`);
        return conn;
    } catch (error) {
        console.error(`Error connecting to MongoDB: ${error}`);
        process.exit(1);
    }
};

// Create the connection
const connection = await connectDB();

export { connection };
export default mongoose.connection;
