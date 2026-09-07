use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

declare_id!("RefEr4lP3yXyZ9qK3mN8vW2jR5tY7uI6oP1aS4dF0gH");

#[program]
pub mod referral {
    use super::*;

    // Initialize referral program
    pub fn initialize(
        ctx: Context<Initialize>,
        fee_bps: u16,
        referrer_share_bps: u16,
    ) -> Result<()> {
        let state = &mut ctx.accounts.state;
        state.authority = ctx.accounts.authority.key();
        state.fee_bps = fee_bps;
        state.referrer_share_bps = referrer_share_bps;
        state.total_swaps = 0;
        state.total_fees_collected = 0;
        state.total_referrals = 0;
        state.bump = *ctx.bumps.get("state").unwrap();
        Ok(())
    }

    // Register a referrer
    pub fn register_referrer(
        ctx: Context<RegisterReferrer>,
        referral_code: String,
    ) -> Result<()> {
        require!(
            referral_code.len() >= 3 && referral_code.len() <= 32,
            ErrorCode::InvalidReferralCode
        );

        let referrer = &mut ctx.accounts.referrer;
        referrer.owner = ctx.accounts.owner.key();
        referrer.referral_code = referral_code;
        referrer.total_referred = 0;
        referrer.total_earnings = 0;
        referrer.created_at = Clock::get()?.unix_timestamp;
        referrer.bump = *ctx.bumps.get("referrer").unwrap();
        Ok(())
    }

    // Track referral when user uses a referral code
    pub fn track_referral(
        ctx: Context<TrackReferral>,
        referral_code: String,
    ) -> Result<()> {
        let referral = &mut ctx.accounts.user_referral;
        referral.user = ctx.accounts.user.key();
        referral.referrer = ctx.accounts.referrer.key();
        referral.referral_code = referral_code;
        referral.total_swaps = 0;
        referral.total_volume = 0;
        referral.total_fees_generated = 0;
        referral.created_at = Clock::get()?.unix_timestamp;
        referral.bump = *ctx.bumps.get("user_referral").unwrap();

        // Increment referrer's total referred count
        let referrer = &mut ctx.accounts.referrer;
        referrer.total_referred += 1;
        Ok(())
    }

    // Execute swap with referral fee
    pub fn execute_swap_with_referral(
        ctx: Context<ExecuteSwapWithReferral>,
        amount_in: u64,
        min_amount_out: u64,
        referral_code: String,
    ) -> Result<()> {
        // Validate minimum amount
        require!(amount_in > 0, ErrorCode::InvalidAmount);
        require!(min_amount_out > 0, ErrorCode::InvalidAmount);

        // Calculate fees
        let state = &ctx.accounts.state;
        let fee_amount = (amount_in as u128 * state.fee_bps as u128 / 10000) as u64;
        let referrer_amount = (fee_amount as u128 * state.referrer_share_bps as u128 / 10000) as u64;
        let treasury_amount = fee_amount - referrer_amount;

        // Transfer fee from user to program
        if fee_amount > 0 {
            let cpi_accounts = Transfer {
                from: ctx.accounts.user_token_account.to_account_info(),
                to: ctx.accounts.fee_vault.to_account_info(),
                authority: ctx.accounts.user.to_account_info(),
            };
            let cpi_program = ctx.accounts.token_program.to_account_info();
            let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
            token::transfer(cpi_ctx, fee_amount)?;
        }

        // Record swap details
        let swap_record = &mut ctx.accounts.swap_record;
        swap_record.user = ctx.accounts.user.key();
        swap_record.amount_in = amount_in;
        swap_record.min_amount_out = min_amount_out;
        swap_record.fee_amount = fee_amount;
        swap_record.referrer_amount = referrer_amount;
        swap_record.treasury_amount = treasury_amount;
        swap_record.referral_code = referral_code;
        swap_record.timestamp = Clock::get()?.unix_timestamp;
        swap_record.executed = true;

        // Update state
        let state = &mut ctx.accounts.state;
        state.total_swaps += 1;
        state.total_fees_collected = state.total_fees_collected.checked_add(fee_amount as u128).unwrap();

        // Update user referral stats if exists
        if let Some(user_referral) = &mut ctx.accounts.user_referral {
            user_referral.total_swaps += 1;
            user_referral.total_volume = user_referral.total_volume.checked_add(amount_in as u128).unwrap();
            user_referral.total_fees_generated = user_referral.total_fees_generated.checked_add(fee_amount as u128).unwrap();
        }

        // Update referrer earnings
        if let Some(referrer) = &mut ctx.accounts.referrer {
            referrer.total_earnings = referrer.total_earnings.checked_add(referrer_amount as u128).unwrap();
        }

        Ok(())
    }

    // Withdraw referrer earnings
    pub fn withdraw_referrer_earnings(
        ctx: Context<WithdrawReferrerEarnings>,
        amount: u64,
    ) -> Result<()> {
        let referrer = &mut ctx.accounts.referrer;
        require!(
            referrer.total_earnings >= amount as u128,
            ErrorCode::InsufficientEarnings
        );

        // Transfer from fee vault to referrer
        let seeds = &[
            b"fee_vault".as_ref(),
            &[ctx.accounts.state.bump],
        ];
        let signer = &[&seeds[..]];

        let cpi_accounts = Transfer {
            from: ctx.accounts.fee_vault.to_account_info(),
            to: ctx.accounts.referrer_token_account.to_account_info(),
            authority: ctx.accounts.fee_vault.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer);
        token::transfer(cpi_ctx, amount)?;

        referrer.total_earnings -= amount as u128;
        Ok(())
    }

    // Update fees (admin only)
    pub fn update_fees(
        ctx: Context<UpdateFees>,
        new_fee_bps: u16,
        new_referrer_share_bps: u16,
    ) -> Result<()> {
        require!(
            new_fee_bps <= 300, // Max 3%
            ErrorCode::FeeTooHigh
        );
        require!(
            new_referrer_share_bps <= 10000,
            ErrorCode::InvalidShare
        );

        let state = &mut ctx.accounts.state;
        state.fee_bps = new_fee_bps;
        state.referrer_share_bps = new_referrer_share_bps;
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + ProgramState::LEN,
        seeds = [b"state"],
        bump
    )]
    pub state: Account<'info, ProgramState>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RegisterReferrer<'info> {
    #[account(
        init,
        payer = owner,
        space = 8 + Referrer::LEN,
        seeds = [b"referrer", owner.key().as_ref()],
        bump
    )]
    pub referrer: Account<'info, Referrer>,
    #[account(mut)]
    pub owner: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(referral_code: String)]
pub struct TrackReferral<'info> {
    #[account(
        init,
        payer = user,
        space = 8 + UserReferral::LEN,
        seeds = [b"user_referral", user.key().as_ref(), referral_code.as_bytes()],
        bump
    )]
    pub user_referral: Account<'info, UserReferral>,
    #[account(
        mut,
        seeds = [b"referrer", referrer.owner.key().as_ref()],
        bump = referrer.bump,
    )]
    pub referrer: Account<'info, Referrer>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(amount_in: u64, min_amount_out: u64, referral_code: String)]
pub struct ExecuteSwapWithReferral<'info> {
    #[account(
        mut,
        seeds = [b"state"],
        bump = state.bump,
    )]
    pub state: Account<'info, ProgramState>,
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(mut)]
    pub user_token_account: Account<'info, TokenAccount>,
    #[account(
        mut,
        seeds = [b"fee_vault", state.key().as_ref()],
        bump,
        token::mint = token_mint,
        token::authority = fee_vault,
    )]
    pub fee_vault: Account<'info, TokenAccount>,
    pub token_mint: Account<'info, anchor_spl::token::Mint>,
    #[account(
        init,
        payer = user,
        space = 8 + SwapRecord::LEN,
        seeds = [b"swap", user.key().as_ref(), &state.total_swaps.to_le_bytes()],
        bump
    )]
    pub swap_record: Account<'info, SwapRecord>,
    #[account(
        mut,
        seeds = [b"referrer", referrer.owner.key().as_ref()],
        bump = referrer.bump,
        constraint = referrer.referral_code == referral_code
    )]
    pub referrer: Option<Account<'info, Referrer>>,
    #[account(
        mut,
        seeds = [b"user_referral", user.key().as_ref(), referral_code.as_bytes()],
        bump = user_referral.bump,
    )]
    pub user_referral: Option<Account<'info, UserReferral>>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct WithdrawReferrerEarnings<'info> {
    #[account(
        mut,
        seeds = [b"state"],
        bump = state.bump,
    )]
    pub state: Account<'info, ProgramState>,
    #[account(
        mut,
        seeds = [b"referrer", referrer.owner.key().as_ref()],
        bump = referrer.bump,
    )]
    pub referrer: Account<'info, Referrer>,
    #[account(mut)]
    pub referrer_token_account: Account<'info, TokenAccount>,
    #[account(
        mut,
        seeds = [b"fee_vault", state.key().as_ref()],
        bump,
    )]
    pub fee_vault: Account<'info, TokenAccount>,
    #[account(mut)]
    pub referrer_owner: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct UpdateFees<'info> {
    #[account(
        mut,
        seeds = [b"state"],
        bump = state.bump,
        constraint = state.authority == authority.key()
    )]
    pub state: Account<'info, ProgramState>,
    pub authority: Signer<'info>,
}

#[account]
pub struct ProgramState {
    pub authority: Pubkey,
    pub fee_bps: u16,
    pub referrer_share_bps: u16,
    pub total_swaps: u64,
    pub total_fees_collected: u128,
    pub total_referrals: u64,
    pub bump: u8,
}

impl ProgramState {
    pub const LEN: usize = 32 + 2 + 2 + 8 + 16 + 8 + 1;
}

#[account]
pub struct Referrer {
    pub owner: Pubkey,
    pub referral_code: String,
    pub total_referred: u64,
    pub total_earnings: u128,
    pub created_at: i64,
    pub bump: u8,
}

impl Referrer {
    pub const LEN: usize = 32 + 64 + 8 + 16 + 8 + 1;
}

#[account]
pub struct UserReferral {
    pub user: Pubkey,
    pub referrer: Pubkey,
    pub referral_code: String,
    pub total_swaps: u64,
    pub total_volume: u128,
    pub total_fees_generated: u128,
    pub created_at: i64,
    pub bump: u8,
}

impl UserReferral {
    pub const LEN: usize = 32 + 32 + 64 + 8 + 16 + 16 + 8 + 1;
}

#[account]
pub struct SwapRecord {
    pub user: Pubkey,
    pub amount_in: u64,
    pub min_amount_out: u64,
    pub fee_amount: u64,
    pub referrer_amount: u64,
    pub treasury_amount: u64,
    pub referral_code: String,
    pub timestamp: i64,
    pub executed: bool,
    pub bump: u8,
}

impl SwapRecord {
    pub const LEN: usize = 32 + 8 + 8 + 8 + 8 + 8 + 64 + 8 + 1 + 1;
}

#[error_code]
pub enum ErrorCode {
    #[msg("Invalid referral code")]
    InvalidReferralCode,
    #[msg("Invalid amount")]
    InvalidAmount,
    #[msg("Insufficient earnings")]
    InsufficientEarnings,
    #[msg("Fee too high")]
    FeeTooHigh,
    #[msg("Invalid share")]
    InvalidShare,
  }
