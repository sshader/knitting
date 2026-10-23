import { httpRouter } from "convex/server";
import { auth } from "./auth";
import { upload } from "./files";

const http = httpRouter();
auth.addHttpRoutes(http);
http.route({ path: "/upload", method: "POST", handler: upload });

export default http;
