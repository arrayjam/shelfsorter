import rw from "rw";
import d3 from "d3";
import Immutable from "immutable";
import inquirer from "inquirer";
import Elo from "arpad";

const elo = new Elo();

const filterShelf = "physically-unread-books";

const csv = rw.readFileSync("./books.csv", "utf8");

let oldScores;
try {
  oldScores = JSON.parse(rw.readFileSync("scores.json", "utf8"));
} catch (e) {
  oldScores = {};
}

let books = Immutable.List();

d3.csv.parse(csv, d => {
  let book = Immutable.Map({
    score: 1200,
    id: d["Book Id"],
    title: d["Title"],
    type: d["Exclusive Shelf"],
    shelves: d["Bookshelves"].split(",").map(shelf => shelf.trim()),
  });
  const id = book.get("id");
  if (id in oldScores) {
    // console.log("Setting ", book.get("title"), " to ", oldScores[id]);
    book = book.set("score", oldScores[id]);
  }

  if (book.get("type") === filterShelf && !book.get("shelves").includes("technical")) {
    books = books.push(book);
  }
});

const randomIndex = () => Math.floor(Math.random() * books.size);

let bookAIndex;
let bookBIndex;

const ask = () => {
  do {
    bookAIndex = randomIndex();
    bookBIndex = randomIndex();
  } while (bookAIndex === bookBIndex);

  const bookATitle = books.getIn([bookAIndex, "title"]);
  const bookBTitle = books.getIn([bookBIndex, "title"]);

  inquirer.prompt([
    {
      type: "list",
      name: "battle",
      message: "Pick a winner",
      choices: [
        "Tie",
        bookATitle,
        bookBTitle,
        "quit",
      ],
    },
  ], answers => {
    if (answers.battle === "quit") {
      books.sortBy(book => book.get("score")).map(book => console.log(book.get("score"), book.get("title")));

      let scores = Immutable.Map();
      books.forEach(book => scores = scores.set(book.get("id"), book.get("score")));
      rw.writeFileSync("scores.json", JSON.stringify(scores.toJS(), null, 2), "utf8");
    } else {
      if (answers.battle === "Tie") {
        books = books.setIn([bookAIndex, "score"], elo.newRatingIfTied(books.getIn([bookAIndex, "score"]), books.getIn([bookBIndex, "score"])));
        books = books.setIn([bookBIndex, "score"], elo.newRatingIfTied(books.getIn([bookBIndex, "score"]), books.getIn([bookAIndex, "score"])));
      } else {
        const winnerIndex = answers.battle === bookATitle ? bookAIndex : bookBIndex;
        const loserIndex = answers.battle === bookATitle ? bookBIndex : bookAIndex;

        books = books.setIn([winnerIndex, "score"], elo.newRatingIfWon(books.getIn([winnerIndex, "score"]), books.getIn([loserIndex, "score"])));
        books = books.setIn([loserIndex, "score"], elo.newRatingIfLost(books.getIn([loserIndex, "score"]), books.getIn([winnerIndex, "score"])));
      }

      ask();
    }
  });
};

ask();
