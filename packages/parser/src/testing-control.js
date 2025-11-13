import { Control } from "./control.js";
import { readFileSync } from "fs";

const control = new Control();

const script = readFileSync("./script.bl", "utf8");

control.run(script);

const disable = `
insert {
  in adult-check {
    meta disable rule
  }

  in people {
    charlie age 20
  }
}
`;
control.run(disable);

const queryResult2 = control.run(`
query
    where { ?p adult true ?c }`)[0];

for (const result of queryResult2) {
    console.log(result.get("p"));
}
