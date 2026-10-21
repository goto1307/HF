// item テーブルで一般ユーザーが読める列。buyer_id は「誰が何を買ったか」が
// 分からないよう列単位で読めなくしているため、select("*") は使えない
// (migration PART V)。購入者が必要なときは get_item_buyer() /
// my_purchased_items() を使う。
export const ITEM_COLUMNS =
  "id,title,price,category,detail,nickname,image_url,image_urls,user_id,sold,received,condition,area,hashtags,created_at";
