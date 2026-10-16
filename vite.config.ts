import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import deployment from "./vercel.json";

export default defineConfig({
  plugins: [react()],
  server: { port: 5173, strictPort: true },
  preview: {
    headers: Object.fromEntries(
      deployment.headers[0].headers.map(({ key, value }) => [key, value]),
    ),
  },
});
