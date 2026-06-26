<?php
header('Content-Type: text/css; charset=UTF-8');
?>
.mjl-auth-page {
	background: #f5f7f8;
	color: #202529;
	font-family: Arial, Helvetica, sans-serif;
	min-height: 100vh;
}

.mjl-auth-shell {
	align-items: center;
	display: flex;
	justify-content: center;
	min-height: 100vh;
	padding: 32px 16px;
}

.mjl-auth-panel {
	background: #ffffff;
	border: 1px solid #d7dee2;
	border-radius: 6px;
	box-shadow: 0 12px 30px rgba(32, 37, 41, 0.08);
	max-width: 430px;
	padding: 28px;
	width: 100%;
}

.mjl-auth-brand {
	border-bottom: 1px solid #e4e9ec;
	margin-bottom: 22px;
	padding-bottom: 18px;
}

.mjl-auth-brand h1 {
	color: #16324f;
	font-size: 24px;
	font-weight: 700;
	letter-spacing: 0;
	line-height: 1.2;
	margin: 0 0 8px;
}

.mjl-auth-brand p,
.mjl-auth-help {
	color: #5c6870;
	font-size: 14px;
	line-height: 1.45;
	margin: 0;
}

.mjl-auth-field {
	margin-bottom: 14px;
	text-align: left;
}

.mjl-auth-field label {
	display: block;
	font-size: 13px;
	font-weight: 700;
	margin-bottom: 6px;
}

.mjl-auth-field input,
.mjl-auth-field select {
	border: 1px solid #b7c2c9;
	border-radius: 4px;
	box-sizing: border-box;
	font-size: 15px;
	min-height: 40px;
	padding: 9px 10px;
	width: 100%;
}

.mjl-auth-actions {
	align-items: center;
	display: flex;
	flex-wrap: wrap;
	gap: 12px;
	margin-top: 18px;
}

.mjl-auth-button {
	background: #16324f;
	border: 1px solid #16324f;
	border-radius: 4px;
	color: #ffffff !important;
	cursor: pointer;
	font-size: 14px;
	font-weight: 700;
	padding: 10px 14px;
	text-decoration: none;
}

.mjl-auth-link {
	color: #164f7a;
	font-size: 14px;
	text-decoration: underline;
}

.mjl-auth-message {
	background: #edf7f2;
	border: 1px solid #b9decf;
	border-radius: 4px;
	color: #1e5b43;
	margin: 14px 0;
	padding: 10px 12px;
	text-align: left;
}

.mjl-auth-error {
	background: #fff1f1;
	border-color: #e3b7b7;
	color: #8a2f2f;
}
