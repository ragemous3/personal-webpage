/*  Probably good to inject params for a DI pattern */
export default function Run(group) {
  const scripts = group.scripts;
  for (const script of scripts) {
    for (const instance of script.instances) {
      // if (script?.binding) {
      //   for (const key in script.binding) {
      //     new script.binding[key](instance.params);
      //   }
      // }
      // console.log(instance);
    }
  }
}
