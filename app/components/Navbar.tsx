import { getAuthData } from "../AuthGuard";
import NavbarClient from "./NavbarClient";

const Navbar = async () => {
  const authData = await getAuthData();
  const role = authData?.role?.toUpperCase();
  const settingsPath =
    role === "ADMIN" ? "/dashboard/admin/settings" : "/dashboard/kasir/settings";

  return <NavbarClient settingsPath={settingsPath} />;
};

export default Navbar;
