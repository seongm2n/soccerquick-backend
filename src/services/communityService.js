const { Post, Comment, User, Admin } = require('../model/models/index');
const { AppError } = require('../middlewares/errorHandler');
const { createPostId, createCommentId } = require('../utils/createIndex');
const toString = require('../utils/toString');

// [ 커뮤니티 전체 게시글 조회 ]
const getAllPosts = async () => {
  try {
    const posts = await Post.find();

    return {
      message: '전체 게시글 조회 성공',
      posts: posts,
    };
  } catch (error) {
    console.error(error);
    return new AppError(500, '전체 게시글 조회 실패');
  }
};

//[ 커뮤니티 게시글 등록 ]
/** ([유저아이디, 제목, 본분, 공지사항여부] 객체) */
const addPost = async (posts) => {
  const { userId, title, description, notice } = posts;

  try {
    const foundUser = await User.findOne({ user_id: userId });

    if (!foundUser) return new AppError(404, '존재하지 않는 아이디입니다.');

    const admin_id = foundUser.admin_id;

    if (notice === '공지사항' && !admin_id)
      return new AppError(403, '관리자만 공지사항을 등록할 수 있습니다.');

    if (foundUser.community_banned) {
      const { community_banEndDate } = foundUser;
      const currentDate = new Date();

      if (community_banEndDate && community_banEndDate <= currentDate) {
        foundUser.community_banned = false;
        foundUser.community_banEndDate = null;

        await foundUser.save();
      } else {
        const dateString = community_banEndDate.toString();
        const newDate = new Date(dateString);

        const options = {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: 'numeric',
          minute: 'numeric',
          second: 'numeric',
          weekday: 'long',
          timeZoneName: 'long',
        };

        const dateFormatter = new Intl.DateTimeFormat('ko-KR', options);
        const translatedDate = dateFormatter.format(newDate);

        const [year, month, date, day, type, hour, minute] =
          translatedDate.split(' ');

        return new AppError(
          403,
          `${year} ${month} ${date} ${day} ${type} ${hour} ${minute} 까지 커뮤니티 이용 정지입니다.`
        );
      }
    }

    const userObjectId = foundUser._id;

    const post_id = await createPostId();

    const newPostField = {
      user_id: userObjectId,
      post_id,
      title,
      description,
      notice,
    };

    const newPost = await Post.create(newPostField);

    return {
      message: '게시글이 등록되었습니다.',
      newPost: newPost,
    };
  } catch (error) {
    console.error(error);
    return new AppError(500, '게시글 등록 실패');
  }
};

//[ 커뮤니티 게시글 수정 ]
/** (게시물 수정 목록 객체) */
const updatePost = async (post) => {
  const { postId, userId, title, description, notice } = post;
  try {
    const foundUser = await User.findOne({ user_id: userId });

    if (!foundUser) return new AppError(400, '존재하지 않는 아이디입니다.');
    if (notice === '공지사항' && !foundUser.admin_id)
      return new AppError(403, '관리자만 공지사항으로 변경 가능합니다.');

    const userObjectId = foundUser._id;

    const foundPost = await Post.findOne({ post_id: postId });

    if (!foundPost) return new AppError(400, '존재하지 않는 게시물입니다.');

    if (toString(userObjectId) !== toString(foundPost.user_id)) {
      return new AppError(400, '본인이 작성한 게시글만 수정 가능합니다.');
    }

    const updatedPostObj = {
      post_id: foundPost.post_id,
      user_id: userObjectId,
      title,
      description,
      notice,
    };

    const updatedPost = await Post.findOneAndUpdate(
      { post_id: postId },
      { $set: updatedPostObj },
      { new: true }
    );

    return { message: '게시물 수정 성공', data: updatedPost };
  } catch (error) {
    console.error(error);
    return new AppError(500, '게시글 수정 실패');
  }
};

//[ 커뮤니티 게시글 삭제 ]
/** (게시글 번호, 게시물 삭제하는 유저아이디) */
const deletePost = async (post_id, userId) => {
  try {
    const foundUser = await User.findOne({ user_id: userId });

    if (!foundUser) return new AppError(400, '존재하지 않는 아이디입니다.');

    const user_id = foundUser._id;

    const foundPost = await Post.findOne({ post_id });

    if (!foundPost) return new AppError(400, '존재하지 않는 게시물 입니다.');
    if (foundUser.admin_id) {
      await Post.deleteOne({ post_id });
      return { message: '게시물이 삭제되었습니다.' };
    }

    if (toString(user_id) !== toString(foundPost.user_id))
      return new AppError(400, '글 작성자만 삭제 가능합니다.');

    if (toString(user_id) === toString(foundPost.user_id)) {
      await Post.deleteOne({ post_id });
      return { message: '게시물이 삭제되었습니다.' };
    }

    return new AppError(403, '삭제 권한이 없습니다.');
  } catch (error) {
    console.error(error);
    return new AppError(500, '게시물 삭제 실패');
  }
};

//[ 커뮤니티 댓글 등록 ]
const addComment = async (postId, user_id, content) => {
  try {
    const foundUser = await User.findOne({ user_id });

    if (!foundUser) return new AppError(404, '존재하지 않는 사용자입니다.');

    const userObjectId = foundUser._id;

    const foundPost = await Post.findOne({ post_id: postId });

    if (!foundPost) return new AppError(404, '존재하지 않는 게시글입니다.');

    const postObjectId = foundPost._id;

    const comment_id = await createCommentId();

    const createComment = await Comment.create({
      comment_id,
      user_id: userObjectId,
      post_id: postObjectId,
      content,
    });

    const commentObjectId = createComment._id;

    foundPost.comments.push(commentObjectId);

    await foundPost.save();

    return { message: '댓글이 등록되었습니다.', data: createComment };
  } catch (error) {
    console.error(error);
    return new AppError(500, '댓글 등록 실패');
  }
};

// [ 커뮤니티 댓글 수정 ]
const updateComment = async (comment) => {
  const { postId, commentId, user_id, content } = comment;

  const foundPost = await Post.findOne({ post_id: postId });
  if (!foundPost) return new AppError(404, '존재하지 않는 게시글 입니다.');

  const postCommentsArray = foundPost.comments;

  const foundComment = await Comment.findOne({ comment_id: commentId });
  if (!foundComment) return new AppError(404, '존재하지 않는 댓글입니다.');

  const commnetObjectId = foundComment._id;
  const commentUserId = toString(foundComment.user_id);

  const foundUser = await User.findOne({ user_id });
  if (!foundUser) return new AppError(404, '존재하지 않는 사용자입니다.');

  const userObjectId = toString(foundUser._id);

  if (commentUserId !== userObjectId)
    return new AppError(403, '댓글 작성자만 수정 가능합니다.');

  const foundUserComment = postCommentsArray.find(
    (comment) => toString(comment) === toString(commnetObjectId)
  );

  if (!foundUserComment)
    return new AppError(404, '댓글이 삭제되었거나 존재하지 않습니다!');

  const updateCommentObj = {
    content: content,
  };

  const updateComment = await Comment.findOneAndUpdate(
    { comment_id: commentId },
    { $set: updateCommentObj },
    { new: true }
  );

  return { message: '댓글 수정 성공', data: updateComment };
};

// [ 커뮤니티 댓글 삭제 ]
const deleteComment = async (comment) => {
  const { postId, commentId, user_id } = comment;

  const foundPost = await Post.findOne({ post_id: postId });
  if (!foundPost) return new AppError(404, '존재하지 않는 게시글 입니다.');

  const postCommentsArray = foundPost.comments;

  const foundComment = await Comment.findOne({ comment_id: commentId });
  if (!foundComment) return new AppError(404, '존재하지 않는 댓글입니다.');

  const commentObjectId = foundComment._id;
  const commentUserId = toString(foundComment.user_id);

  const foundUser = await User.findOne({ user_id });
  if (!foundUser) return new AppError(404, '존재하지 않는 사용자입니다.');

  const userObjectId = toString(foundUser._id);

  if (commentUserId !== userObjectId)
    return new AppError(403, '댓글 작성자만 삭제 가능합니다.');

  const foundUserComment = postCommentsArray.find(
    (comment) => toString(comment) === toString(commentObjectId)
  );

  if (!foundUserComment)
    return new AppError(404, '댓글이 삭제되었거나 존재하지 않습니다!');

  await Comment.deleteOne({ comment_id: commentId });

  foundPost.comments.pull(commentObjectId);
  await foundPost.save();

  return { message: '댓글 삭제 성공' };
};

module.exports = {
  addPost,
  getAllPosts,
  updatePost,
  deletePost,
  addComment,
  updateComment,
  deleteComment,
};