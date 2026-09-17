import { installImplementation } from "temporal-polyfill/shim";

// Force our Temporal implementation on the server (workerd) until a native one is verified there.
installImplementation();
