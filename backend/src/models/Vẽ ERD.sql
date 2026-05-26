// DBML for dbdiagram.io
// Import in dbdiagram.io using: New Diagram -> Import -> DBML

Table users {
  id bigint [pk]
  ho_ten varchar(100) [not null]
  email varchar(255) [not null, unique]
  mat_khau varchar(255) [not null]
  vai_tro varchar(20) [not null]
  is_locked boolean [not null, default: false]
  ngay_tao datetime [not null]
}

Table seasons {
  id bigint [pk]
  ten_mua_vu varchar(255) [not null]
  nam int [not null]
  thang_bat_dau int
  thang_ket_thuc int
  trang_thai varchar(50)
  mo_ta text
  ngay_tao datetime
}

Table gardens {
  id bigint [pk]
  user_id bigint [not null, ref: > users.id]
  season_id bigint [ref: > seasons.id]
  ten_vuon varchar(100) [not null]
  dien_tich decimal(12,2) [not null]
  don_vi varchar(20)
  dia_chi varchar(255) [not null]
  so_cay int
  ngay_tao datetime
  ngay_cap_nhat datetime
}

Table plots {
  id bigint [pk]
  garden_id bigint [not null, ref: > gardens.id]
  name varchar(120) [not null]
  area decimal(12,2) [not null]
  tree_type varchar(100) [not null]
  location_description varchar(300)
  status varchar(50)
  created_at datetime
}

Table tasks {
  id bigint [pk]
  ten_cong_viec varchar(255) [not null]
  mo_ta text
  dieu_kien_thuc_hien text
  ngay_tao datetime
}

Table notifications {
  id bigint [pk]
  tieu_de varchar(255) [not null]
  noi_dung text [not null]
  doi_tuong_nhan varchar(20) [not null]
  nhom_nguoi_nhan text [note: 'MongoDB array of String']
  da_doc_boi text [note: 'MongoDB array of String']
  link varchar(255)
  trang_thai varchar(20) [not null]
  loai varchar(20) [not null]
  task_id bigint [ref: > tasks.id]
  ngay_lam datetime
  ghi_chu text
  nhac_nho_cho_notification_id bigint [ref: > notifications.id]
  ngay_tao datetime
}

Table logs {
  id bigint [pk]
  garden_id bigint [not null, ref: > gardens.id]
  season_id bigint [not null, ref: > seasons.id]
  notification_id bigint [ref: > notifications.id]
  task_id bigint [not null, ref: > tasks.id]
  plot_id bigint [not null, ref: > plots.id]
  plot_ids text [note: 'MongoDB array of ObjectId']
  ngay_lam datetime [not null]
  ghi_chu text
  is_completed boolean [not null, default: false]
  nguoi_thuc_hien varchar(255)
  ngay_tao datetime
}

Table expenses {
  id bigint [pk]
  garden_id bigint [not null, ref: > gardens.id]
  season_id bigint [not null, ref: > seasons.id]
  loai_chi_phi varchar(100) [not null]
  plot_ids text [note: 'MongoDB array of ObjectId']
  items text [note: 'MongoDB embedded subdocuments']
  so_tien decimal(18,2) [not null]
  ngay datetime [not null]
  don_vi varchar(10)
  ngay_tao datetime
  ngay_cap_nhat datetime
}

Table predictions {
  id bigint [pk]
  user_id bigint [not null, ref: > users.id]
  hinh_anh varchar(255) [not null]
  ket_qua_benh varchar(255) [not null]
  do_tin_cay decimal(5,2)
  mo_ta_benh text
  huong_xu_ly text
  tuvan_ai text
  grad_cam_path varchar(255)
  thoi_gian_xu_ly_ms int
  ngay_du_doan datetime
}

Table fertilizers {
  id bigint [pk]
  ten_phan_bon varchar(255) [not null, unique]
  mo_ta text
  thanh_phan text [not null]
  cong_dung text [not null]
  gia_tien decimal(18,2) [not null]
  cach_su_dung text
  don_vi varchar(20) [not null]
  ngay_tao datetime
  ngay_cap_nhat datetime
}

Table pesticides {
  id bigint [pk]
  ten_thuoc varchar(255) [not null, unique]
  mo_ta text
  loai varchar(50) [not null]
  hoat_chat text [not null]
  gia_tien decimal(18,2) [not null]
  cach_su_dung text
  muc_do_doc_hai varchar(50) [not null]
  ngay_tao datetime
  ngay_cap_nhat datetime
}

Table diseases {
  id bigint [pk]
  ten_benh varchar(255) [not null, unique]
  mo_ta text [not null]
  nguyen_nhan text
  trieu_chung text
  huong_xu_ly text [not null]
  loai_cay_bi_anh_huong text [note: 'MongoDB array of String']
  muc_do_nguy_hiem varchar(50)
  ten_benh_en varchar(255) [not null, unique]
  ngay_tao datetime
}

Table disease_fertilizers {
  disease_id bigint [not null, ref: > diseases.id]
  fertilizer_id bigint [not null, ref: > fertilizers.id]

  Indexes {
    (disease_id, fertilizer_id) [pk]
  }
}

Table disease_pesticides {
  disease_id bigint [not null, ref: > diseases.id]
  pesticide_id bigint [not null, ref: > pesticides.id]

  Indexes {
    (disease_id, pesticide_id) [pk]
  }
}

Table notification_tracking {
  id bigint [pk]
  notification_id bigint [not null, ref: > notifications.id]
  user_id bigint [not null, ref: > users.id]
  garden_id bigint [not null, ref: > gardens.id]
  plot_id bigint [not null, ref: > plots.id]
  status varchar(20) [not null]
  ngay_tao datetime
  ngay_cap_nhat datetime

  Indexes {
    (notification_id, user_id, garden_id, plot_id) [unique]
  }
}

