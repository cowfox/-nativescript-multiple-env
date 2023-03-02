import { environmentBase } from "./environment.base";

export const environment = {
  // Include the `base` configs
  ...environmentBase,

  // Changes on a specific env.
  debug: true,
};
