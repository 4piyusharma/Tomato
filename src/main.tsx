import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { AppProvider } from "./context/AppContext.tsx";

import "leaflet/dist/leaflet.css";
import { SocketProvider } from "./context/SocketContext.tsx";

export const authService = "https://tomatos-service.onrender.com";
export const restaurantService = "https://restaurants-service-1.onrender.com";
export const utilsService = "https://utilsss-service.onrender.com";
export const realtimeService = "https://realtimes-service-m3j7.onrender.com";
export const riderService = "https://riders-service-1.onrender.com";
export const adminService = "https://admins-service-1.onrender.com";


// export const authService = "http://localhost:5000"; 
// export const restaurantService = "http://localhost:5001";
// export const utilsService = "http://localhost:5002";
// export const realtimeService = "http://localhost:5004";
// export const riderService = "http://localhost:5005";
// export const adminService = "http://localhost:5006";


createRoot(document.getElementById("root")!).render(
  <GoogleOAuthProvider clientId="420695276118-c79htcskbuo8kjb4a904ujtmjqfac705.apps.googleusercontent.com">
    <AppProvider>
      <SocketProvider>
        <App />
      </SocketProvider>
    </AppProvider>
  </GoogleOAuthProvider>,
);
