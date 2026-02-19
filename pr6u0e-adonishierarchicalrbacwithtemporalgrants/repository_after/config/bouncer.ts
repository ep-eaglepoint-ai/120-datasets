// @ts-nocheck
import { defineConfig } from "@adonisjs/bouncer";

const bouncerConfig = defineConfig({
  /*
  |--------------------------------------------------------------------------
  | Default Authorizer
  |--------------------------------------------------------------------------
  |
  | Define the default authorizer that will be used when no explicit
  | authorizer is defined for a bouncer check.
  |
  */
  default: "lucid",

  /*
  |--------------------------------------------------------------------------
  | Authorizers
  |--------------------------------------------------------------------------
  |
  | Define authorizers for performing authorization checks. The "lucid"
  | authorizer uses the Lucid models for authorization.
  |
  */
  authorizers: {
    lucid: {
      driver: "lucid",
      identifierKey: "id",
    },
  },

  /*
  |--------------------------------------------------------------------------
  | Policies
  |--------------------------------------------------------------------------
  |
  | Define policies for authorization. Policies are classes that contain
  | authorization logic for specific resources or actions.
  |
  */
  policies: {
    RolePolicy: () => import("#policies/role_policy"),
  },
});

export default bouncerConfig;
