CREATE TABLE `llx_mjlfinancement_activity` (
  `rowid` int(11) NOT NULL AUTO_INCREMENT,
  `entity` int(11) NOT NULL,
  `ref` varchar(128) NOT NULL,
  `fk_partner` int(11) NOT NULL,
  `fk_project` int(11) NOT NULL,
  `name` varchar(255) NOT NULL,
  `description` text NOT NULL,
  `date_start` date NOT NULL,
  `date_end` date NOT NULL,
  `draft_authorized_amount` bigint(20) NOT NULL,
  `first_submitted_amount` bigint(20) DEFAULT NULL,
  `latest_validated_amount` bigint(20) DEFAULT NULL,
  `validation_status` varchar(40) NOT NULL DEFAULT 'DRAFT',
  `is_cancelled` tinyint(1) NOT NULL DEFAULT 0,
  `version` bigint(20) NOT NULL DEFAULT 1,
  `date_creation` datetime NOT NULL,
  `tms` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `fk_user_creat` int(11) NOT NULL,
  `fk_user_modif` int(11) DEFAULT NULL,
  `fk_user_responsible` int(11) DEFAULT NULL,
  PRIMARY KEY (`rowid`),
  UNIQUE KEY `uk_mjl_activity_entity_ref` (`entity`,`ref`),
  KEY `idx_mjl_activity_entity_project` (`entity`,`fk_project`),
  KEY `idx_mjl_activity_entity_partner` (`entity`,`fk_partner`),
  KEY `idx_mjl_activity_entity_validation` (`entity`,`validation_status`),
  KEY `idx_mjl_activity_project_fk` (`fk_project`),
  KEY `idx_mjl_activity_partner_fk` (`fk_partner`),
  KEY `idx_mjl_activity_creator` (`fk_user_creat`),
  KEY `idx_mjl_activity_modifier` (`fk_user_modif`),
  CONSTRAINT `fk_mjl_activity_target_partner` FOREIGN KEY (`fk_partner`) REFERENCES `llx_societe` (`rowid`) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT `fk_mjl_activity_target_project` FOREIGN KEY (`fk_project`) REFERENCES `llx_projet` (`rowid`) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT `fk_mjl_activity_target_creator` FOREIGN KEY (`fk_user_creat`) REFERENCES `llx_user` (`rowid`) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT `fk_mjl_activity_target_modifier` FOREIGN KEY (`fk_user_modif`) REFERENCES `llx_user` (`rowid`) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT `chk_mjl_activity_entity_positive` CHECK (`entity` > 0),
  CONSTRAINT `chk_mjl_activity_ref_nonblank` CHECK (`ref` REGEXP '[^[:space:]]'),
  CONSTRAINT `chk_mjl_activity_name_nonblank` CHECK (`name` REGEXP '[^[:space:]]'),
  CONSTRAINT `chk_mjl_activity_description_nonblank` CHECK (`description` REGEXP '[^[:space:]]'),
  CONSTRAINT `chk_mjl_activity_dates` CHECK (`date_end` >= `date_start`),
  CONSTRAINT `chk_mjl_activity_draft_amount` CHECK (`draft_authorized_amount` >= 0),
  CONSTRAINT `chk_mjl_activity_first_amount` CHECK (`first_submitted_amount` IS NULL OR `first_submitted_amount` >= 0),
  CONSTRAINT `chk_mjl_activity_validated_amount` CHECK (`latest_validated_amount` IS NULL OR `latest_validated_amount` >= 0),
  CONSTRAINT `chk_mjl_activity_validation_status` CHECK (`validation_status` IN ('DRAFT','SUBMITTED','RETURNED_SUPERVISOR','PREVALIDATED','RETURNED_VALIDATOR','FINAL_VALIDATED','CANCELLED')),
  CONSTRAINT `chk_mjl_activity_cancelled` CHECK (`is_cancelled` IN (0,1) AND ((`is_cancelled` = 1 AND `validation_status` = 'CANCELLED') OR (`is_cancelled` = 0 AND `validation_status` <> 'CANCELLED'))),
  CONSTRAINT `chk_mjl_activity_version` CHECK (`version` >= 1),
  CONSTRAINT `chk_mjl_activity_responsible_dormant` CHECK (`fk_user_responsible` IS NULL),
  CONSTRAINT `chk_mjl_activity_rst005_dormant` CHECK (`validation_status` = 'DRAFT' AND `is_cancelled` = 0 AND `first_submitted_amount` IS NULL AND `latest_validated_amount` IS NULL)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

DELIMITER $$
CREATE TRIGGER `llx_mjl_activity_rst005_bi`
BEFORE INSERT ON `llx_mjlfinancement_activity`
FOR EACH ROW
BEGIN
  DECLARE partner_entity int(11) DEFAULT -1;
  DECLARE project_entity int(11) DEFAULT -1;
  DECLARE project_partner int(11) DEFAULT -1;
  DECLARE creator_entity int(11) DEFAULT -1;
  DECLARE modifier_entity int(11) DEFAULT -1;
  DECLARE partner_found int(11) DEFAULT 0;
  DECLARE project_found int(11) DEFAULT 0;
  DECLARE creator_found int(11) DEFAULT 0;
  DECLARE modifier_found int(11) DEFAULT 0;
  SELECT count(*), max(`entity`) INTO partner_found, partner_entity FROM `llx_societe` WHERE `rowid` = NEW.`fk_partner`;
  SELECT count(*), max(`entity`), max(`fk_soc`) INTO project_found, project_entity, project_partner FROM `llx_projet` WHERE `rowid` = NEW.`fk_project`;
  SELECT count(*), max(`entity`) INTO creator_found, creator_entity FROM `llx_user` WHERE `rowid` = NEW.`fk_user_creat`;
  IF NEW.`fk_user_modif` IS NOT NULL THEN
    SELECT count(*), max(`entity`) INTO modifier_found, modifier_entity FROM `llx_user` WHERE `rowid` = NEW.`fk_user_modif`;
  END IF;
  IF partner_found <> 1
     OR project_found <> 1
     OR creator_found <> 1
     OR NOT (partner_entity <=> NEW.`entity`)
     OR NOT (project_entity <=> NEW.`entity`)
     OR NOT (project_partner <=> NEW.`fk_partner`)
     OR NOT (creator_entity <=> NEW.`entity`)
     OR (NEW.`fk_user_modif` IS NOT NULL AND (modifier_found <> 1 OR NOT (modifier_entity <=> NEW.`entity`))) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Invalid MJL Activity entity relationship';
  END IF;
END$$
CREATE TRIGGER `llx_mjl_activity_rst005_bu`
BEFORE UPDATE ON `llx_mjlfinancement_activity`
FOR EACH ROW
SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'MJL Activity mutation is dormant in RST-005'$$
CREATE TRIGGER `llx_mjl_activity_rst005_bd`
BEFORE DELETE ON `llx_mjlfinancement_activity`
FOR EACH ROW
SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'MJL Activity deletion is dormant in RST-005'$$
DELIMITER ;
