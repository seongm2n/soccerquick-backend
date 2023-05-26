const { User } = require('../model/models/index');
const { AppError } = require('../middlewares/errorHandler');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const {
  BCRYPT_SALT_ROUNDS,
  ACCESS_TOKEN_SECRET,
  REFRESH_TOKEN_SECRET,
  ACCESS_TOKEN_EXPIRES_IN,
  REFRESH_TOKEN_EXPIRES_IN,
} = require('../envconfig');

//[ 비밀번호 해싱 ]
const hashPassword = async (password) => {
  const saltRounds = parseInt(BCRYPT_SALT_ROUNDS);
  const hashedPassword = await bcrypt.hash(password, saltRounds);
  return hashedPassword;
};

//[ 유저 회원가입 ]
const signUpUser = async (userId, password, next) => {
  try {
    const foundUser = await User.findOne({ $or: [{ userId }] });

    if (foundUser && foundUser.userId === userId) {
      return next(new AppError(400, '이미 존재하는 아이디 입니다.'));
    }

    const hashedPassword = await hashPassword(password);

    const addUser = await User.create({
      userId,
      password: hashedPassword,
    });

    await addUser.save();

    return;
  } catch (error) {
    console.error(error);
    throw new AppError(500, '회원가입에 실패하였습니다.');
  }
};

/**[유저 로그인] */
const logInUser = async (userId, password, next) => {
  try {
    const foundUser = await User.findOne({ userId });

    if (!foundUser) {
      return next(new AppError(400, '존재하지 않는 아이디입니다.'));
    }

    const isMatched = await bcrypt.compare(password, foundUser.password);

    if (!isMatched) {
      return next(new AppError(400, '비밀번호가 일치하지 않습니다.'));
    }

    const payload = {
      userId: foundUser.userId,
      password: foundUser.password,
    };

    //[accessToken 생성]
    const accessToken = jwt.sign(payload, ACCESS_TOKEN_SECRET, {
      expiresIn: ACCESS_TOKEN_EXPIRES_IN,
    });

    //[refreshToken 생성]
    const refreshToken = jwt.sign(payload, REFRESH_TOKEN_SECRET, {
      expiresIn: REFRESH_TOKEN_EXPIRES_IN,
    });

    return {
      accessToken,
      refreshToken,
      userData: {
        userId: foundUser.userId,
      },
    };
  } catch (error) {
    console.error(error);
    throw new AppError(500, '로그인에 실패하였습니다');
  }
};

module.exports = {
  signUpUser,
  logInUser,
};