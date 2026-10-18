import { expect, type Page } from "@playwright/test";
import { TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD } from "../test-env";

export async function login(page: Page, email = TEST_ADMIN_EMAIL, password = TEST_ADMIN_PASSWORD) {
  await page.goto("/login");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
}

export async function loginAsAdmin(page: Page) {
  await login(page);
  await expect(page).not.toHaveURL(/\/login/);
}
