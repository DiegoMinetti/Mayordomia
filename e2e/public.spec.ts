import { expect, test } from '@playwright/test';

test.describe('Public request wizard — /solicitar', () => {
  test('renders the type selector on first load', async ({ page }) => {
    await page.goto('/solicitar');
    await expect(page.getByRole('heading', { name: 'Mayordomía' })).toBeVisible();
    await expect(
      page.getByRole('heading', { name: '¿En qué podemos ayudarte?' })
    ).toBeVisible();
    await expect(page.getByText('Solicitar recursos')).toBeVisible();
    await expect(page.getByText('Reservar un espacio')).toBeVisible();
  });

  test('advances from the type selector to the contact form', async ({ page }) => {
    await page.goto('/solicitar');
    await page.getByText('Solicitar recursos').click();
    await expect(
      page.getByRole('heading', { name: '¿Para qué lo necesitás?' })
    ).toBeVisible();
    await expect(page.getByLabel('Tu nombre')).toBeVisible();
    await expect(page.getByLabel('Evento o motivo')).toBeVisible();
  });

  test('walks through to the confirmation step and submits', async ({ page }) => {
    await page.goto('/solicitar');
    await page.getByText('Solicitar sonido').click();
    await page.getByLabel('Tu nombre').fill('E2E Tester');
    await page.getByLabel('Teléfono o email').fill('tester@example.com');
    await page.getByLabel('Evento o motivo').fill('Culto de prueba');
    await page.getByRole('button', { name: 'Continuar' }).click();
    await expect(
      page.getByRole('heading', { name: '¿Cuándo y dónde?' })
    ).toBeVisible();
    await page.getByRole('button', { name: 'Continuar' }).click();
    await expect(
      page.getByRole('heading', { name: 'Detalles y confirmación' })
    ).toBeVisible();
    await page.getByLabel('¿Qué necesitás exactamente?').fill('Dos micrófonos y consola.');
    await page.getByRole('button', { name: 'Enviar solicitud' }).click();
    await expect(
      page.getByRole('heading', { name: 'Solicitud recibida' })
    ).toBeVisible();
    await expect(page.getByText('SOL-2026-00143')).toBeVisible();
  });

  test('honors the ?area= preset query string', async ({ page }) => {
    await page.goto('/solicitar?area=resource');
    // Skips step 0 and lands directly on the contact form.
    await expect(
      page.getByRole('heading', { name: '¿Para qué lo necesitás?' })
    ).toBeVisible();
  });
});
