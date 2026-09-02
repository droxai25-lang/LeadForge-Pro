import "dotenv/config";
import { defineConfig } from "@prisma/config";
import { resolveDatabaseConnectionString } from "./databaseConnection";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations"
  },
  datasource: {
    url: resolveDatabaseConnectionString(process.env)
  }
});
