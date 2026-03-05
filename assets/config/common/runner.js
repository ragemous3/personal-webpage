export default function Run(group) {
  const scripts = group.scripts;
  console.log(group);
  for (const script of scripts) {
    console.log(script);
    for (const instance of script.instances) {
      console.log(instance);
    }
  }
}
