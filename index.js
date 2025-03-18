require("dotenv").config();
const express = require("express");
const { Telegraf, Markup, session } = require("telegraf");
const connectDb = require("./config");
const userSchema = require("./schema/user");
const testSchema = require("./schema/tests");
const app = express();

const bot = new Telegraf(process.env.BOT_TOKEN);
connectDb();

// Holatni boshqarish uchun session
let ctx = {
  resolved_testId: null,
  session: {
    isWaitingForTestNumber: false,
    isWaitingForTestQuestions: false,
    isWaitingForTestAnswers: false,
  },
};

// starting bot
bot.start(async (btx) => {
  const chat = btx.chat;
  const admins = await userSchema.find({ role: "admin" });

  const user = await userSchema.findOne({ id: chat.id });
  if (user) {
    if (user.role === "admin") {
      btx.reply(
        `Salom ${chat.first_name}, nima yordam bera olaman?`,
        Markup.inlineKeyboard([
          [Markup.button.callback("Test yaratish", "test_button")],
        ]),
        Markup.inlineKeyboard([
          [Markup.button.callback("O'quvchilarni natijalari", "watch_results")],
        ])
      );
    } else {
      btx.reply(
        "Testlarni yechib bo'lgach javoblarni quyidagi ko'rinishda jo'nating aks holda javoblaringiz inobatga olinmaydi : 1C,2B,3D"
      );
      const tests = await testSchema.find();

      const testButtons = tests.map((test) =>
        Markup.button.callback(
          `${test.test_number}`,
          `test_${test.test_number}`
        )
      );

      btx.reply(
        `Salom ${chat.first_name}, botimizga qaytganingiz uchun rahmat. Test ishlash uchun test raqamni tanlang`,
        Markup.inlineKeyboard(testButtons)
      );
      const user = await userSchema.findOne({ id: chat.id });
      tests.forEach(async (test) => {
        bot.action(`test_${test.test_number}`, async (btx) => {
          if (!test.resolved_users.includes(user._id)) {
            const question = await testSchema.findOne({ _id: test._id });
            const user = await userSchema.findOne({ id: chat.id });
            user.selected_test = question._id;
            await user.save();

            btx.reply(`Test ${test.test_number} savollari:\n${question.tests}`);
          } else {
            btx.reply(
              "Siz bu testni allaqachon ishlagansiz, qaytadan ishlay olmaysiz"
            );
          }
        });
      });

      bot.on("text", async (btx) => {
        const text = btx.message.text;
        const user = await userSchema.findOne({ id: btx.chat.id });
        const selectedTest = await testSchema.findOne({
          _id: user.selected_test,
        });
        const splitedAnswers = text.split(",");
        const answerOfTest = selectedTest.answers.split(",");
        let overall = 0;
        for (let i = 0; i < answerOfTest.length; i++) {
          if (
            splitedAnswers[i] &&
            answerOfTest[i].toLowerCase() === splitedAnswers[i].toLowerCase()
          ) {
            overall++;
          }
        }

        if (overall >= answerOfTest.length / 1.5) {
          user.resolved_tests.push(selectedTest._id);
          await user.save();
          selectedTest.resolved_users.push(user._id);
          await selectedTest.save();
          if (selectedTest.resolved_users.length <= 3) {
            user.grades = overall * 2.5;
            await user.save();
          } else if (selectedTest.resolved_users.length <= 7) {
            user.grades = overall * 1.7;
            await user.save();
          } else if (selectedTest.resolved_users.length <= 10) {
            user.grades = overall * 0.8;
            await user.save();
          }
          btx.reply(
            "Sizning javoblaringiz adminga jo'natildi birozdan so'ng o'zi aloqaga chiqadi, sizning natijangiz" +
              overall +
              "/" +
              answerOfTest.length
          );
        } else {
          btx.reply(
            "Siz bu testdan o'ta olmadingiz xohlasangiz qaytadan topshiring. Sizning umumiy topgan javoblaringiz: " +
              overall +
              "/" +
              answerOfTest.length
          );
        }
        user.selected_test = "";
        await user.save();
      });
    }
  } else {
    await userSchema.create({ ...chat });
    btx.reply(
      `Salom ${chat.first_name}, botimizga xush kelibsiz. Test ishlash uchun test raqamni kiriting masalan: 1`
    );
  }
});

// Admin test yaratish bosqichi
bot.action("test_button", (btx) => {
  ctx.session.isWaitingForTestNumber = true;
  btx.reply("Juda yaxshi, test yaratish uchun test raqamini kiriting");

  bot.on("text", async (btx) => {
    const chatId = btx.chat.id;
    const text = btx.message.text;

    if (ctx.session.isWaitingForTestNumber && text) {
      if (!isNaN(text) && text.trim() !== "") {
        const existTest = await testSchema.findOne({ test_number: text });

        if (existTest) {
          const existTestNumbers = await testSchema
            .find()
            .select("test_number");

          const testNumbers = existTestNumbers
            .map((test) => test.test_number)
            .join(", ");

          btx.reply(
            `Bu test raqami allaqachon mavjud. Iltimos, shu raqamlardan boshqa raqam tanlang: ${testNumbers}`
          );
        } else {
          ctx.session.testNumber = text;
          ctx.session.isWaitingForTestNumber = false;
          ctx.session.isWaitingForTestQuestions = true;
          btx.reply(
            `Juda yaxshi! Endi barcha test savollarini kiriting. Misol uchun:\n\n1. 1+2 javobi necha bo'ladi?\nA. 1\nB. 2\nC. 3\nD. 4`
          );
        }
      } else {
        btx.reply("Iltimos, faqat raqam kiriting. Raqam qabul qilinadi!");
      }
    }

    //   // Test savollarini kiritayotganini tekshirish
    if (
      ctx.session.isWaitingForTestQuestions &&
      ctx.session.testNumber &&
      text &&
      text !== ctx.session.testNumber
    ) {
      ctx.session.testQuestions = text;
      ctx.session.isWaitingForTestQuestions = false;
      ctx.session.isWaitingForTestAnswers = true;
      btx.reply(
        `Endi barcha testlarni to'g'ri javoblarini vergul bilan ajratib yozing, masalan: 1A,2B,3D`
      );
    }

    //   // Test javoblarini kiritayotganini tekshirish
    if (
      ctx.session.isWaitingForTestAnswers &&
      ctx.session.testQuestions &&
      text &&
      text !== ctx.session.testQuestions
    ) {
      ctx.session.testAnswers = text;
      ctx.session.isWaitingForTestAnswers = false;

      // Testni bazaga saqlash
      await testSchema.create({
        test_number: ctx.session.testNumber,
        tests: ctx.session.testQuestions,
        answers: ctx.session.testAnswers,
      });

      btx.reply(
        `Test muvaffaqiyatli yaratildi!\nTest raqami: ${ctx.session.testNumber}\nSavollar: ${ctx.session.testQuestions}\nJavoblar: ${ctx.session.testAnswers}`
      );

      // Sessionni tozalash
      ctx.session = {};
    }
  });
});

// SHU JOYDA BARCHA OQUVCHILARNI ISMI CHIQADI VA ULARNI BOSGANDA BARCHA ISHLAGAN TESTLARI CHIQADI MASALAN 1 SAVOLGA 10 TA SAVOLDAN 5 TASINI TOPDI VA 20 BALL OLDI VA BALLARNI YOZGANDA ARRAY ICHIDA OBJECT SHAKLIDA QANCHA SAVOLGA JAVOB TOPGANI VA NECHA BALL OLGANI QILIB OZGARTIRILADI
bot.action("watch_results", (btx) => {});
bot.launch();

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Server is running on the " + PORT);
});
