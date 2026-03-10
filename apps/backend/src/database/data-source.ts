import "dotenv/config";
import { DataSource } from "typeorm";
import path from "path";

const AppDataSource = new DataSource({
  type: "postgres",
  host: process.env["POSTGRES_HOST"] ?? "localhost",
  port: Number(process.env["POSTGRES_PORT"] ?? 5432),
  username: process.env["POSTGRES_USER"] ?? "campaign",
  password: process.env["POSTGRES_PASSWORD"] ?? "campaign_secret",
  database: process.env["POSTGRES_DB"] ?? "campaign",
  entities: [path.join(__dirname, "/../**/*.entity.{ts,js}")],
  migrations: [path.join(__dirname, "/migrations/*.{ts,js}")],
  synchronize: false,
  logging: true,
});

export default AppDataSource;
