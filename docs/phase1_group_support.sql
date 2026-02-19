-- Extensiones para grupos de hospedaje (fase 1)
-- Aplica sobre la BD base Script_BD_EcoPosada_Tisey.sql

CREATE TABLE stay_groups (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  group_code VARCHAR(30) NOT NULL UNIQUE,
  name VARCHAR(120) NULL,
  check_in_date DATE NOT NULL,
  check_out_date DATE NOT NULL,
  status ENUM('BOOKED','CHECKED_IN','CHECKED_OUT','CANCELLED') NOT NULL DEFAULT 'CHECKED_IN',
  created_by BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  notes VARCHAR(255) NULL,
  KEY idx_stay_groups_dates (check_in_date, check_out_date),
  CONSTRAINT fk_staygroup_createdby FOREIGN KEY (created_by) REFERENCES users(id),
  CONSTRAINT chk_staygroup_dates CHECK (check_out_date >= check_in_date)
) ENGINE=InnoDB;

ALTER TABLE stays
  ADD COLUMN group_id BIGINT UNSIGNED NULL AFTER primary_guest_id,
  ADD KEY idx_stays_group (group_id),
  ADD CONSTRAINT fk_stay_group FOREIGN KEY (group_id) REFERENCES stay_groups(id);

ALTER TABLE orders
  ADD COLUMN stay_group_id BIGINT UNSIGNED NULL AFTER stay_id,
  ADD KEY idx_orders_stay_group (stay_group_id),
  ADD CONSTRAINT fk_order_staygroup FOREIGN KEY (stay_group_id) REFERENCES stay_groups(id);

ALTER TABLE invoices
  ADD COLUMN stay_group_id BIGINT UNSIGNED NULL AFTER stay_id,
  ADD KEY idx_invoice_stay_group (stay_group_id),
  ADD CONSTRAINT fk_inv_staygroup FOREIGN KEY (stay_group_id) REFERENCES stay_groups(id);
