import { getAuthData } from "../AuthGuard";
import NavbarClient from "./NavbarClient";

const Navbar = async () => {
  const authData = await getAuthData();
  const role = authData?.role?.toUpperCase();
  const settingsPath =
    role === "ADMIN"
      ? "/dashboard/admin/settings"
      : role === "KASIR"
        ? "/dashboard/kasir/settings"
        : role === "SALES"
          ? "/dashboard/sales/settings"
          : role === "KEPALA_GUDANG"
            ? "/dashboard/kepala_gudang/settings"
            : "/dashboard";

  return <NavbarClient settingsPath={settingsPath} />;
};

export default Navbar;
