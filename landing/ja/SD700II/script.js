document.addEventListener('DOMContentLoaded', () => {

    /* =======================================
       1. Hero Slider Logic 
       ======================================= */
    const slides = document.querySelectorAll('.slide');
    const dots = document.querySelectorAll('.slider-dot');
    let currentSlide = 0;
    const slideIntervalDelay = 5000; // 5秒ごとにスライド切り替え
    let slideInterval;

    const showSlide = (index) => {
        // 全スライドとドットのリセット
        slides.forEach(slide => slide.classList.remove('active'));
        dots.forEach(dot => dot.classList.remove('active'));

        // 指定のインデックスをアクティブ化
        slides[index].classList.add('active');
        dots[index].classList.add('active');
        currentSlide = index;
    };

    const nextSlide = () => {
        let nextIndex = (currentSlide + 1) % slides.length;
        showSlide(nextIndex);
    };

    // 自動スライド開始
    const startSlideInterval = () => {
        slideInterval = setInterval(nextSlide, slideIntervalDelay);
    };

    // ドット・クリック時の制御
    dots.forEach((dot, index) => {
        dot.addEventListener('click', () => {
            clearInterval(slideInterval); // 手動操作時はインターバルをリセット
            showSlide(index);
            startSlideInterval(); // 再設定
        });
    });

    startSlideInterval();


    /* =======================================
       2. Accordion Logic (Detailed Specs)
       ======================================= */
    const accordionTrigger = document.querySelector('.accordion-trigger');
    const accordionContent = document.getElementById('spec-details');
    const accordionClose = document.querySelector('.accordion-close');

    if (accordionTrigger && accordionContent && accordionClose) {

        const toggleAccordion = () => {
            const isHidden = accordionContent.hasAttribute('hidden');
            if (isHidden) {
                accordionContent.removeAttribute('hidden');
                accordionTrigger.setAttribute('aria-expanded', 'true');
                accordionTrigger.textContent = '▲ 詳しいスペック・試験条件を閉じる';
            } else {
                accordionContent.setAttribute('hidden', '');
                accordionTrigger.setAttribute('aria-expanded', 'false');
                accordionTrigger.textContent = '▼ 詳しいスペック・試験条件を見る';
            }
        };

        // 開く/閉じるトリガー
        accordionTrigger.addEventListener('click', toggleAccordion);

        // 内部の閉じるボタン
        accordionClose.addEventListener('click', () => {
            toggleAccordion();
            // 閉じた後にトリガーの位置に少しスクロールを戻すと親切
            accordionTrigger.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
    }

    /* =======================================
       3. Smooth Scroll for Anchor Links
       ======================================= */
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const targetId = this.getAttribute('href');
            if (targetId === '#') return;

            const targetElement = document.querySelector(targetId);
            if (targetElement) {
                targetElement.scrollIntoView({
                    behavior: 'smooth'
                });
            }
        });
    });

    /* =======================================
       4. Form Validation + Confirm + Submit
       ======================================= */
    const downloadForm = document.getElementById('download-form');
    const successMsg = document.getElementById('form-success-message');
    const confirmPanel = document.getElementById('form-confirm-panel');
    const confirmBackBtn = document.getElementById('confirm-back');
    const confirmSubmitBtn = document.getElementById('confirm-submit');
    const globalError = document.getElementById('form-global-error');
    const confirmError = document.getElementById('confirm-error');
    const formHeader = document.querySelector('.form-header');
    const pageUrlInput = document.getElementById('page_url');
    const turnstileTokenInput = document.getElementById('turnstileToken');
    const successBackToTopBtn = document.getElementById('success-back-to-top');

    if (pageUrlInput) {
        pageUrlInput.value = window.location.href;
    }

    const requiredFields = ['company', 'name', 'email'];
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    const setFieldError = (fieldName, message) => {
        const field = downloadForm?.querySelector(`[name="${fieldName}"]`);
        const errorEl = downloadForm?.querySelector(`[data-error-for="${fieldName}"]`);
        if (field) {
            field.classList.add('field-invalid');
            field.setAttribute('aria-invalid', 'true');
        }
        if (errorEl) {
            errorEl.textContent = message;
            errorEl.removeAttribute('hidden');
        }
    };

    const clearFieldError = (fieldName) => {
        const field = downloadForm?.querySelector(`[name="${fieldName}"]`);
        const errorEl = downloadForm?.querySelector(`[data-error-for="${fieldName}"]`);
        if (field) {
            field.classList.remove('field-invalid');
            field.removeAttribute('aria-invalid');
        }
        if (errorEl) {
            errorEl.textContent = '';
            errorEl.setAttribute('hidden', '');
        }
    };

    const clearAllErrors = () => {
        requiredFields.forEach(clearFieldError);
        if (globalError) {
            globalError.textContent = '';
            globalError.setAttribute('hidden', '');
        }
        if (confirmError) {
            confirmError.textContent = '';
            confirmError.setAttribute('hidden', '');
        }
    };

    const collectPayload = () => {
        const turnstileToken = typeof window.turnstile !== 'undefined'
            ? (window.turnstile.getResponse() || '')
            : '';
        if (turnstileTokenInput) {
            turnstileTokenInput.value = turnstileToken;
        }

        const formData = new FormData(downloadForm);
        return {
            company: (formData.get('company') || '').toString().trim(),
            department: (formData.get('department') || '').toString().trim(),
            name: (formData.get('name') || '').toString().trim(),
            email: (formData.get('email') || '').toString().trim(),
            phone: (formData.get('phone') || '').toString().trim(),
            interest: formData.getAll('interest').map((v) => v.toString()),
            consideration_phase: formData.getAll('consideration_phase').map((v) => v.toString()),
            message: (formData.get('message') || '').toString().trim(),
            page_url: (formData.get('page_url') || '').toString().trim(),
            lp_id: (formData.get('lp_id') || '').toString().trim(),
            lp_version: (formData.get('lp_version') || '').toString().trim(),
            form_schema_version: (formData.get('form_schema_version') || '').toString().trim(),
            locale: (formData.get('locale') || '').toString().trim(),
            country: (formData.get('country') || '').toString().trim(),
            requested_material: (formData.get('requested_material') || '').toString().trim(),
            turnstileToken: (formData.get('turnstileToken') || '').toString().trim()
        };
    };

    const validatePayload = (payload) => {
        const errors = [];

        requiredFields.forEach((field) => {
            if (!payload[field]) {
                errors.push({ field, message: 'この項目は必須です。' });
            }
        });

        if (payload.email && !emailPattern.test(payload.email)) {
            errors.push({ field: 'email', message: 'メールアドレスの形式が正しくありません。' });
        }

        if (!payload.turnstileToken) {
            errors.push({ field: 'turnstile', message: 'スパム対策認証が完了していません。' });
        }

        return errors;
    };

    const fillConfirmPanel = (payload) => {
        const fallback = '未入力';
        const valueMap = {
            company: payload.company || fallback,
            department: payload.department || fallback,
            name: payload.name || fallback,
            email: payload.email || fallback,
            phone: payload.phone || fallback,
            interest: payload.interest.length ? payload.interest.join(' / ') : fallback,
            consideration_phase: payload.consideration_phase.length ? payload.consideration_phase.join(' / ') : fallback,
            message: payload.message || fallback
        };

        Object.entries(valueMap).forEach(([key, value]) => {
            const target = confirmPanel?.querySelector(`[data-confirm="${key}"]`);
            if (target) {
                target.textContent = value;
            }
        });
    };

    const switchToConfirm = () => {
        downloadForm.setAttribute('hidden', '');
        confirmPanel.removeAttribute('hidden');
        successMsg.setAttribute('hidden', '');
        formHeader?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    const switchToEdit = () => {
        confirmPanel.setAttribute('hidden', '');
        downloadForm.removeAttribute('hidden');
        formHeader?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    const switchToSuccess = () => {
        confirmPanel.setAttribute('hidden', '');
        downloadForm.setAttribute('hidden', '');
        successMsg.removeAttribute('hidden');
        formHeader?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    const resetToInitialState = () => {
        downloadForm.reset();
        clearAllErrors();
        confirmPanel.setAttribute('hidden', '');
        successMsg.setAttribute('hidden', '');
        downloadForm.removeAttribute('hidden');

        if (pageUrlInput) {
            pageUrlInput.value = window.location.href;
        }
    };

    if (downloadForm) {
        requiredFields.forEach((fieldName) => {
            const field = downloadForm.querySelector(`[name="${fieldName}"]`);
            if (!field) return;
            field.addEventListener('input', () => clearFieldError(fieldName));
        });

        downloadForm.addEventListener('submit', (e) => {
            e.preventDefault();
            clearAllErrors();

            const payload = collectPayload();
            const errors = validatePayload(payload);

            if (errors.length > 0) {
                errors.forEach((err) => {
                    if (err.field === 'turnstile') return;
                    setFieldError(err.field, err.message);
                });
                if (globalError) {
                    const hasTurnstileError = errors.some((err) => err.field === 'turnstile');
                    globalError.textContent = hasTurnstileError
                        ? '必須項目または認証に不備があります。内容をご確認ください。'
                        : '必須項目または入力形式に不備があります。内容をご確認ください。';
                    globalError.removeAttribute('hidden');
                }
                return;
            }

            fillConfirmPanel(payload);
            switchToConfirm();
        });
    }

    if (confirmBackBtn) {
        confirmBackBtn.addEventListener('click', () => {
            clearAllErrors();
            switchToEdit();
        });
    }

    if (confirmSubmitBtn) {
        confirmSubmitBtn.addEventListener('click', async () => {
            clearAllErrors();
            confirmSubmitBtn.disabled = true;
            const originalLabel = confirmSubmitBtn.textContent;
            confirmSubmitBtn.textContent = '送信中...';

            try {
                const payload = collectPayload();
                const response = await fetch('/api/contact', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(payload)
                });

                const result = await response.json().catch(() => ({}));
                if (!response.ok || !result?.ok) {
                    throw new Error('submit_failed');
                }

                switchToSuccess();
            } catch (error) {
                if (confirmError) {
                    confirmError.textContent = '送信に失敗しました。時間をおいて再度お試しください。';
                    confirmError.removeAttribute('hidden');
                }
            } finally {
                confirmSubmitBtn.disabled = false;
                confirmSubmitBtn.textContent = originalLabel;
            }
        });
    }

    if (successBackToTopBtn) {
        successBackToTopBtn.addEventListener('click', (e) => {
            e.preventDefault();
            resetToInitialState();
            if (typeof window.turnstile !== 'undefined') {
                window.turnstile.reset();
            }
            document.getElementById('hero')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
    }

});
